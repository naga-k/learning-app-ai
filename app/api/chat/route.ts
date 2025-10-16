import {
  streamText,
  generateText,
  convertToModelMessages,
  stepCountIs,
  getToolOrDynamicToolName,
  isToolOrDynamicToolUIPart,
} from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import {
  CourseSchema,
  LearningPlanSchema,
  formatLearningPlanText,
  normalizeCourse,
  normalizeLearningPlan,
  summarizeCourseForChat,
  type LearningPlanWithIds,
} from '@/lib/curriculum';
import { extractJsonFromText } from '@/lib/ai/json';
import { buildLearningPlanPrompt } from '@/lib/prompts/plan';
import {
  buildCourseOverviewPrompt,
  buildCourseSubmodulePrompt,
  buildCourseConclusionPrompt,
} from '@/lib/prompts/course';
import {
  planningAndDeliveryPrimer,
  discoveryPhasePrimer,
  personalizationPrimer,
  systemPrompt,
} from '@/lib/prompts/system';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getChatSession, insertChatMessage, listChatMessages, saveCourseVersion } from '@/lib/db/operations';
import { randomUUID } from 'crypto';
import type { UIMessage } from 'ai';
import {
  activeAIProvider,
  activeAIProviderName,
  getModel,
  getModelId,
  supportsOpenAIWebSearch,
} from '@/lib/ai/provider';
import { generateChatTitle } from '@/lib/chat/title';
import { isPlanToolOutput } from '@/lib/ai/tool-output';

export const runtime = 'nodejs';

const isOpenAIProvider = activeAIProviderName === 'openai';
const webSearchTool = supportsOpenAIWebSearch
  ? activeAIProvider.tools.webSearch({
      searchContextSize: 'high',
    })
  : undefined;
const webSearchTools = webSearchTool ? { web_search: webSearchTool } : undefined;

const planProviderOptions = isOpenAIProvider
  ? {
      openai: {
        reasoningEffort: 'low',
        textVerbosity: 'low',
      },
    }
  : undefined;

const courseProviderOptions = isOpenAIProvider
  ? {
      openai: {
        reasoningEffort: 'low',
        textVerbosity: 'high',
      },
    }
  : undefined;

const chatProviderOptions = isOpenAIProvider
  ? {
      openai: {
        reasoningEffort: 'low',
        textVerbosity: 'low',
        parallelToolCalls: false,
      },
    }
  : undefined;

type GenerateTextParams = Parameters<typeof generateText>[0];

const JSON_ONLY_REMINDER =
  '\n\nReminder: Respond with valid JSON that matches the required schema. Do not include commentary before or after the JSON.';

const isJsonStructureError = (error: unknown) => {
  if (error instanceof z.ZodError) return true;
  if (!(error instanceof Error)) return false;

  const message = error.message ?? '';

  if (/Could not extract valid JSON/i.test(message)) return true;
  if (/Unexpected token/i.test(message) && message.includes('JSON')) return true;
  if (/Unexpected end of JSON input/i.test(message)) return true;
  if (error.name === 'SyntaxError' && /JSON/.test(message)) return true;

  return false;
};

type GenerateJsonWithRetryParams<T> = {
  prompt: string;
  model: GenerateTextParams['model'];
  tools?: GenerateTextParams['tools'];
  providerOptions?: GenerateTextParams['providerOptions'];
  parse: (text: string) => T;
};

const generateJsonWithRetry = async <T>({
  prompt,
  model,
  tools,
  providerOptions,
  parse,
}: GenerateJsonWithRetryParams<T>) => {
  const attempt = async (effectivePrompt: string) => {
    const options: GenerateTextParams = {
      model,
      prompt: effectivePrompt,
      tools,
      providerOptions,
    };
    const generation = await generateText(options);

    return parse(generation.text);
  };

  try {
    return await attempt(prompt);
  } catch (error) {
    if (!isJsonStructureError(error)) throw error;
    return await attempt(`${prompt}${JSON_ONLY_REMINDER}`);
  }
};

// Allow streaming responses up to 30 seconds

const CourseResourceSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  url: z.string().optional(),
  type: z.string().optional(),
});

const CourseOverviewResultSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  focus: z.string().optional(),
  resources: z.array(CourseResourceSchema).optional(),
});

const CourseSubmoduleResultSchema = z.object({
  content: z.string().min(1),
  summary: z.string().optional(),
  recommendedResources: z.array(CourseResourceSchema).optional(),
});

const CourseConclusionResultSchema = z.object({
  summary: z.string().optional(),
  celebrationMessage: z.string().optional(),
  recommendedNextSteps: z.array(z.string().min(1)).optional(),
  stretchIdeas: z.array(z.string().min(1)).optional(),
});

type CourseResource = z.infer<typeof CourseResourceSchema>;
type CourseOverviewResult = z.infer<typeof CourseOverviewResultSchema>;
type CourseSubmoduleResult = z.infer<typeof CourseSubmoduleResultSchema>;
type CourseConclusionResult = z.infer<typeof CourseConclusionResultSchema>;

const createInstructionMessage = (id: string, text: string): UIMessage => ({
  id,
  role: 'assistant',
  parts: [
    {
      type: 'text',
      text,
    },
  ],
});

const hasToolOutput = (messages: UIMessage[], toolName: string): boolean =>
  messages.some((message) => {
    if (!message || message.role !== 'assistant') return false;
    if (!Array.isArray(message.parts)) return false;

    return message.parts.some((part) => {
      if (!isToolOrDynamicToolUIPart(part)) return false;
      if (getToolOrDynamicToolName(part) !== toolName) return false;

      const { state, preliminary } = part as {
        state?: string;
        preliminary?: boolean;
      };

      return state === 'output-available' && preliminary !== true;
    });
  });

const extractLatestStructuredPlan = (
  messages: UIMessage[],
): LearningPlanWithIds | null => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== 'assistant') continue;
    if (!Array.isArray(message.parts)) continue;

    for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = message.parts[partIndex];
      if (!isToolOrDynamicToolUIPart(part)) continue;
      if (getToolOrDynamicToolName(part) !== 'generate_plan') continue;

      const { state, preliminary } = part as {
        state?: string;
        preliminary?: boolean;
      };

      if (state !== 'output-available' || preliminary) continue;

      const payload =
        (part as { output?: unknown }).output ??
        (part as { result?: unknown }).result;

      if (isPlanToolOutput(payload) && payload.structuredPlan) {
        try {
          return normalizeLearningPlan(
            LearningPlanSchema.parse(payload.structuredPlan),
          );
        } catch (error) {
          console.warn('[chat] Failed to normalize structured plan from history', error);
          return payload.structuredPlan as LearningPlanWithIds;
        }
      }
    }
  }
  return null;
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 },
    );
  }

  const body = await req.json();
  console.log('[chat] incoming body keys:', Object.keys(body ?? {}));
  const { message, sessionId } = body;

  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json(
      { error: 'sessionId is required' },
      { status: 400 },
    );
  }

  const session = await getChatSession(sessionId, user.id);
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 },
    );
  }

  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const historyRows = await listChatMessages(sessionId, user.id);
  const historyMessages = historyRows.map((row) => row.content as UIMessage);

  const latestUserMessage = message as UIMessage;

  await insertChatMessage({
    id: randomUUID(),
    sessionId,
    role: 'user',
    content: latestUserMessage,
  });

  const messages: UIMessage[] = [...historyMessages, latestUserMessage];
  let latestStructuredPlan = extractLatestStructuredPlan(messages);

  const planGenerated = hasToolOutput(messages, 'generate_plan');
  const courseGenerated = hasToolOutput(messages, 'generate_course');

  const instructionMessages: UIMessage[] = [
    createInstructionMessage('primer-planning', planningAndDeliveryPrimer),
  ];

  if (!planGenerated && !courseGenerated) {
    instructionMessages.push(
      createInstructionMessage('primer-discovery', discoveryPhasePrimer),
    );
    instructionMessages.push(
      createInstructionMessage('primer-personalization', personalizationPrimer),
    );
  }

  console.log('[chat] using AI provider:', activeAIProviderName, {
    chat: getModelId('chat'),
    plan: getModelId('plan'),
    course: getModelId('course'),
  });

  // ------------------------------
  // Tool: Generate Personalized Plan
  // ------------------------------
  const generatePlanTool = {
    description:
      'Generate a hyper-personalized learning plan based on ALL the context gathered from the conversation. This creates truly customized courses unlike generic platforms.',
    inputSchema: z.object({
      fullConversationContext: z.string().describe(`A comprehensive, detailed summary of EVERYTHING discussed with the user. Include:
- What they want to learn (topic, subject, skill)
- WHY they want to learn it (goals, motivation, use case, personal reasons)
- How much time they have available
- Their current experience level and relevant background
- Any specific focus areas, preferences, or constraints they mentioned
- Learning style preferences if discussed
- Real-world applications they're interested in
- Any prior attempts or struggles they mentioned
- Career goals or personal projects related to this learning
- Literally anything else that makes this course PERSONAL to them

Be verbose and detailed - this context is used to create a truly personalized learning experience.`),
      modificationRequest: z.string().nullable().optional(),
      currentPlan: z.string().nullable().optional(),
    }),
    execute: async ({
      fullConversationContext,
      modificationRequest,
      currentPlan,
    }: {
      fullConversationContext: string;
      modificationRequest?: string | null;
      currentPlan?: string | null;
    }) => {
      console.log('[generate_plan] Creating personalized plan with context length:', fullConversationContext.length);

      const planningPrompt = buildLearningPlanPrompt({
        fullConversationContext,
        modificationRequest,
        currentPlan,
      });

        const startTime = Date.now();

        try {
          console.log('[generate_plan] Calling generateText (reasoningEffort=low)...');
          const planObject = await generateJsonWithRetry({
            prompt: planningPrompt,
            model: getModel('plan'),
            tools: webSearchTools,
            providerOptions: planProviderOptions,
            parse: (text) => {
              const planJsonText = extractJsonFromText(text);
              const parsedPlan = JSON.parse(planJsonText);
              return LearningPlanSchema.parse(parsedPlan);
            },
          });

        console.log('[generate_plan] Personalized plan generated successfully!');
        const elapsedMs = Date.now() - startTime;

        const structuredPlan = normalizeLearningPlan(planObject);
        latestStructuredPlan = structuredPlan;
        const planText = formatLearningPlanText(structuredPlan);

        return {
          plan: planText,
          structuredPlan,
          summary: `Plan ready—tell me if you want any tweaks or say "Generate the course."`,
          startedAt: startTime,
          durationMs: elapsedMs,
          ctaSuggestions: [
            {
              label: 'Generate course',
              message: 'Generate the course',
            },
            {
              label: 'Edit the plan',
              message: 'Can we edit the plan?',
            },
          ],
        };
      } catch (error) {
        console.error('[generate_plan] failed after ms:', Date.now() - startTime, error);
        latestStructuredPlan = null;
        throw error instanceof Error ? error : new Error(String(error));
      }
    },
  };

  // ------------------------------
  // Tool: Generate Personalized Course
  // ------------------------------
  const generateCourseTool = {
    description:
      'Generate complete, hyper-personalized course content with full lessons tailored exactly to this learner.',
    inputSchema: z.object({
      fullContext: z.string().describe(`Everything about this learner and their approved plan. Include:
- The complete approved learning plan
- All conversation context (their goals, motivations, experience level, interests, constraints)
- Any specific examples or use cases they want to see
- Their learning preferences or style if discussed
- Career goals or projects that motivated this learning
- Literally everything that makes this course PERSONAL

Be comprehensive - this is used to create course content that feels custom-made for them.`),
      planStructure: z.union([z.string(), z.any()])
        .nullable()
        .optional(),
    }),
    execute: async ({
      fullContext,
      planStructure,
    }: {
      fullContext: string;
      planStructure?: string | unknown | null;
    }) => {
      console.log('[generate_course] Creating personalized course with context length:', fullContext.length);

      let parsedPlan: LearningPlanWithIds | null = null;

      if (planStructure) {
        try {
          const json =
            typeof planStructure === 'string'
              ? JSON.parse(planStructure)
              : planStructure;
          parsedPlan = normalizeLearningPlan(LearningPlanSchema.parse(json));
        } catch {
          parsedPlan = null;
        }
      }

      if (!parsedPlan && latestStructuredPlan) parsedPlan = latestStructuredPlan;

      const startTime = Date.now();

      if (!parsedPlan) {
        throw new Error(
          'Unable to generate the course because an approved learning plan was not found. Ask me to create a plan first.',
        );
      }

      try {
        console.log('[generate_course] Generating course overview...');
        const overviewResult = await generateJsonWithRetry<CourseOverviewResult>({
          prompt: buildCourseOverviewPrompt({
            fullContext,
            plan: parsedPlan,
          }),
          model: getModel('course'),
          tools: webSearchTools,
          providerOptions: courseProviderOptions,
          parse: (text) => {
            const overviewJsonText = extractJsonFromText(text);
            const parsedOverview = JSON.parse(overviewJsonText);
            return CourseOverviewResultSchema.parse(parsedOverview);
          },
        });

        const aggregatedResources: CourseResource[] = [
          ...(overviewResult.resources ?? []),
        ];
        const generatedSubmodules = new Map<string, CourseSubmoduleResult>();
        const completedLessonLabels: string[] = [];

        for (const planModule of parsedPlan.modules) {
          for (const subtopic of planModule.subtopics) {
            const completionSummary = completedLessonLabels.length
              ? completedLessonLabels
                  .map((label, index) => `${index + 1}. ${label}`)
                  .join('\n')
              : '';

            console.log(
              '[generate_course] Generating lesson:',
              `${planModule.title} -> ${subtopic.title}`,
            );

            const submoduleResult = await generateJsonWithRetry<CourseSubmoduleResult>({
              prompt: buildCourseSubmodulePrompt({
                fullContext,
                plan: parsedPlan,
                module: planModule,
                subtopic,
                completedLessonsSummary: completionSummary,
              }),
              model: getModel('course'),
              tools: webSearchTools,
              providerOptions: courseProviderOptions,
              parse: (text) => {
                const submoduleJsonText = extractJsonFromText(text);
                const parsedSubmodule = JSON.parse(submoduleJsonText);
                return CourseSubmoduleResultSchema.parse(parsedSubmodule);
              },
            });

            generatedSubmodules.set(subtopic.id, submoduleResult);
            if (Array.isArray(submoduleResult.recommendedResources)) {
              submoduleResult.recommendedResources.forEach((resource) => {
                aggregatedResources.push(resource);
              });
            }

            completedLessonLabels.push(`${planModule.title} — ${subtopic.title}`);
          }
        }

        let conclusionResult: CourseConclusionResult | null = null;

        const courseHighlights = completedLessonLabels.length
          ? completedLessonLabels
              .map((label, index) => `${index + 1}. ${label}`)
              .join('\n')
          : 'No lessons were generated in this draft.';

        try {
          console.log('[generate_course] Generating course conclusion...');
          conclusionResult = await generateJsonWithRetry<CourseConclusionResult>({
            prompt: buildCourseConclusionPrompt({
              fullContext,
              plan: parsedPlan,
              courseHighlights,
            }),
            model: getModel('course'),
            tools: webSearchTools,
            providerOptions: courseProviderOptions,
            parse: (text) => {
              const conclusionJsonText = extractJsonFromText(text);
              const parsedConclusion = JSON.parse(conclusionJsonText);
              return CourseConclusionResultSchema.parse(parsedConclusion);
            },
          });
        } catch (conclusionError) {
          console.warn(
            '[generate_course] Conclusion generation failed; proceeding without conclusion.',
            conclusionError,
          );
          conclusionResult = null;
        }

        const dedupedResources = (() => {
          if (aggregatedResources.length === 0) return [];
          const seen = new Set<string>();
          const result: CourseResource[] = [];

          aggregatedResources.forEach((resource) => {
            const key = `${resource.title.trim().toLowerCase()}|${(resource.url ?? '').trim().toLowerCase()}`;
            if (seen.has(key)) return;
            seen.add(key);
            result.push(resource);
          });

          return result;
        })();

        const courseObject = {
          overview: {
            title: overviewResult.title,
            description: overviewResult.description,
            focus: overviewResult.focus ?? undefined,
            totalDuration: parsedPlan.overview.totalDuration,
          },
          modules: parsedPlan.modules.map((planModule) => ({
            moduleId: planModule.id,
            title: planModule.title,
            summary: planModule.objective,
            submodules: planModule.subtopics.map((subtopic) => {
              const generated = generatedSubmodules.get(subtopic.id);
              const fallbackContent = [
                `## ${subtopic.title}`,
                '',
                'Content is currently unavailable. Please regenerate this lesson.',
              ].join('\n');

              return {
                id: subtopic.id,
                title: subtopic.title,
                duration: subtopic.duration ?? undefined,
                content: generated?.content ?? fallbackContent,
                summary: generated?.summary ?? subtopic.description,
              };
            }),
          })),
          resources: dedupedResources.length > 0 ? dedupedResources : undefined,
          conclusion: conclusionResult ?? undefined,
        };

        const validatedCourseObject = CourseSchema.parse(courseObject);
        const structuredCourse = normalizeCourse(validatedCourseObject, parsedPlan);
        const courseSummary = summarizeCourseForChat(structuredCourse);

        const courseTitle =
          structuredCourse.overview?.title?.trim() ??
          structuredCourse.overview?.focus?.trim() ??
          structuredCourse.modules[0]?.title ??
          'Personalised course';

        await saveCourseVersion({
          userId: user.id,
          sessionId,
          title: courseTitle,
          summary: courseSummary,
          structured: structuredCourse,
        });

        const elapsedMs = Date.now() - startTime;
        console.log('[generate_course] Total generation time (ms):', elapsedMs);

        return {
          course: courseSummary,
          courseStructured: structuredCourse,
          summary: `Generated your personalized course with content tailored to your specific goals and needs`,
          startedAt: startTime,
          durationMs: elapsedMs,
        };
      } catch (error) {
        const elapsedMs = Date.now() - startTime;
        console.error(
          '[generate_course] structured course failed after ms:',
          elapsedMs,
          error,
        );

        let friendlyMessage =
          'Course generation failed due to an unexpected error. Please try again.';

        if (error instanceof Error) {
          const message = error.message?.trim();
          if (error.name === 'AI_APICallError' || /timeout/i.test(message ?? '')) {
            friendlyMessage =
              'Course generation timed out while contacting the model. Please try again.';
          } else if (message) {
            friendlyMessage = `Course generation failed: ${message}`;
          }
        } else if (typeof error === 'string' && error.trim().length > 0) {
          friendlyMessage = `Course generation failed: ${error.trim()}`;
        }

        return {
          errorMessage: friendlyMessage,
          startedAt: startTime,
          durationMs: elapsedMs,
        };
      }
    },
  };

  // ------------------------------
  // Main Agent (Primary Model)
  // ------------------------------
  const convertibleMessages = [
    ...instructionMessages,
    ...messages.filter((message) =>
      message.role === 'system' || message.role === 'user' || message.role === 'assistant',
    ),
  ];

  const result = streamText({
    model: getModel('chat'),
    system: systemPrompt,
    messages: convertToModelMessages(convertibleMessages),
    tools: {
      generate_plan: generatePlanTool,
      generate_course: generateCourseTool,
    },
    stopWhen: stepCountIs(3),
    providerOptions: chatProviderOptions,
  });
  const generateResponseMessageId = () => randomUUID();

  return result.toUIMessageStreamResponse({
    generateMessageId: generateResponseMessageId,
    onFinish: async ({ responseMessage, isAborted }) => {
      try {
        if (isAborted) return;
        if (!responseMessage || responseMessage.role !== 'assistant') return;
        if (!Array.isArray(responseMessage.parts) || responseMessage.parts.length === 0) return;

        const messageId =
          responseMessage.id && responseMessage.id.trim().length > 0
            ? responseMessage.id
            : generateResponseMessageId();
        const messageToPersist: UIMessage = {
          ...responseMessage,
          id: messageId,
        };

        await insertChatMessage({
          id: messageToPersist.id,
          sessionId,
          role: 'assistant',
          content: messageToPersist,
        });

        void generateChatTitle({
          sessionId,
          userId: user.id,
          messages: [...messages, messageToPersist],
        }).catch((error) => {
          console.error('[chat] failed to generate chat title', error);
        });
      } catch (error) {
        console.error('[chat] failed to persist assistant message', error);
      }
    },
  });
}
