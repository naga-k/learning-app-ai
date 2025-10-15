import { streamText, generateText, convertToModelMessages, stepCountIs } from 'ai';
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
import { buildCoursePrompt } from '@/lib/prompts/course';
import { systemPrompt } from '@/lib/prompts/system';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  getChatSession,
  insertChatMessage,
  listChatMessages,
  saveCourseVersion,
} from '@/lib/db/operations';
import { randomUUID } from 'crypto';
import type { UIMessage } from 'ai';
import {
  activeAIProvider,
  activeAIProviderName,
  getModel,
  getModelId,
  supportsOpenAIWebSearch,
} from '@/lib/ai/provider';

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

  let latestStructuredPlan: LearningPlanWithIds | null = null;

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
          summary: `Created a personalized learning plan tailored to your specific goals and context. Remind them this is the roadmap—once it feels right they can say "Generate the course" for full lessons.`,
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

      const coursePrompt = buildCoursePrompt({
        fullContext,
        plan: parsedPlan,
      });

      const startTime = Date.now();

        try {
          console.log('[generate_course] Calling generateText (reasoningEffort=low)...');
          const courseObject = await generateJsonWithRetry({
            prompt: coursePrompt,
            model: getModel('course'),
            tools: webSearchTools,
            providerOptions: courseProviderOptions,
            parse: (text) => {
              const courseJsonText = extractJsonFromText(text);
              const parsedCourse = JSON.parse(courseJsonText);
              return CourseSchema.parse(parsedCourse);
            },
          });

        const structuredCourse = normalizeCourse(courseObject, parsedPlan);
        const courseSummary = summarizeCourseForChat(structuredCourse);

        await saveCourseVersion({
          userId: user.id,
          sessionId,
          title: structuredCourse.overview?.focus ?? structuredCourse.modules[0]?.title ?? 'Personalised course',
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
  const convertibleMessages = messages.filter((message) =>
    message.role === 'system' || message.role === 'user' || message.role === 'assistant',
  );

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
      } catch (error) {
        console.error('[chat] failed to persist assistant message', error);
      }
    },
  });
}
