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
  type CourseWithIds,
  LearningPlanSchema,
  formatLearningPlanText,
  normalizeLearningPlan,
  type LearningPlanWithIds,
} from '@/lib/curriculum';
import { extractJsonFromText } from '@/lib/ai/json';
import { buildLearningPlanPrompt } from '@/lib/prompts/plan';
import {
  planningAndDeliveryPrimer,
  discoveryPhasePrimer,
  personalizationPrimer,
  systemPrompt,
} from '@/lib/prompts/system';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  createCourseGenerationJob,
  getCourseGenerationJob,
  getChatSession,
  insertChatMessage,
  listChatMessages,
  markCourseGenerationJobFailed,
  setCourseGenerationJobAssistantMessageId,
  listCourseEngagementBlocks,
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
import { generateChatTitle } from '@/lib/chat/title';
import { isPlanToolOutput, type CourseEngagementBlockSummary } from '@/lib/ai/tool-output';
import { mergeCourseToolOutputIntoMessage } from '@/lib/chat/messages';
import { createGeneratePlanTool } from '@/lib/ai/tools/generate-plan';
import { createGenerateCourseTool } from '@/lib/ai/tools/generate-course';

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
  const generatePlanTool = createGeneratePlanTool({
    model: getModel('plan'),
    webSearchTools,
    providerOptions: planProviderOptions,
  });

  // ------------------------------
  // Tool: Generate Personalized Course
  // ------------------------------
  const generateCourseTool = createGenerateCourseTool({
    userId: user.id,
    sessionId,
    latestStructuredPlan,
  });

  // ------------------------------
  // Main Agent (Primary Model)
  // ------------------------------
  const convertibleMessages = [
    ...instructionMessages,
    ...messages.filter((message) =>
      message.role === 'system' || message.role === 'user' || message.role === 'assistant',
    ),
  ];

  const stripWebSearchParts = (parts?: UIMessage['parts']): UIMessage['parts'] =>
    Array.isArray(parts)
      ? parts.filter(
        (part): part is UIMessage['parts'][number] => {
          if (!isToolOrDynamicToolUIPart(part)) return true;
          return getToolOrDynamicToolName(part) !== 'web_search';
        },
      )
      : (parts ?? []);

  const result = streamText({
    model: getModel('chat'),
    system: systemPrompt,
    messages: convertToModelMessages(convertibleMessages),
    tools: {
      generate_plan: generatePlanTool,
      generate_course: generateCourseTool,
      ...(webSearchTools ?? {}),
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
          parts: stripWebSearchParts(responseMessage.parts),
        };

        await insertChatMessage({
          id: messageToPersist.id,
          sessionId,
          role: 'assistant',
          content: messageToPersist,
        });

        try {
          for (const part of responseMessage.parts) {
            if (!isToolOrDynamicToolUIPart(part)) continue;
            if (getToolOrDynamicToolName(part) !== 'generate_course') continue;
            if (part.state !== 'output-available') continue;

            const payload =
              (part as { output?: unknown }).output ??
              (part as { result?: unknown }).result;

            const jobId =
              payload &&
                typeof payload === 'object' &&
                payload !== null &&
                'jobId' in payload
                ? (payload as { jobId?: unknown }).jobId
                : undefined;

            if (typeof jobId === 'string' && jobId.trim().length > 0) {
              await setCourseGenerationJobAssistantMessageId({
                jobId,
                assistantMessageId: messageToPersist.id,
              });

              const jobRecord = await getCourseGenerationJob({
                jobId,
                userId: user.id,
              });

              if (
                jobRecord?.status === 'completed' &&
                jobRecord.resultCourseStructured
              ) {
                let engagementSummary:
                  | CourseEngagementBlockSummary[]
                  | undefined;
                if (jobRecord.resultCourseVersionId) {
                  const storedBlocks = await listCourseEngagementBlocks({
                    courseVersionId: jobRecord.resultCourseVersionId,
                  });
                  engagementSummary = storedBlocks.map((block) => ({
                    blockId: block.blockId,
                    blockType: block.blockType,
                    blockRevision: block.blockRevision,
                    contentHash: block.contentHash,
                    submoduleId: block.submoduleId,
                  }));
                }
                await mergeCourseToolOutputIntoMessage({
                  messageId: messageToPersist.id,
                  updates: {
                    jobId,
                    status: 'completed',
                    course:
                      jobRecord.resultSummary ??
                      'Your personalized course is ready.',
                    summary:
                      jobRecord.resultSummary ??
                      'Your personalized course is ready.',
                    courseStructured: jobRecord
                      .resultCourseStructured as CourseWithIds,
                    courseId: jobRecord.resultCourseId ?? undefined,
                    courseVersionId: jobRecord.resultCourseVersionId ?? undefined,
                    engagementBlocks: engagementSummary,
                  },
                });
              } else if (jobRecord?.status === 'failed' && jobRecord.error) {
                await mergeCourseToolOutputIntoMessage({
                  messageId: messageToPersist.id,
                  updates: {
                    jobId,
                    status: 'failed',
                    summary: `Course generation failed: ${jobRecord.error}`,
                    course: `Course generation failed: ${jobRecord.error}`,
                  },
                });
              }
            }
          }
        } catch (error) {
          console.error(
            '[chat] failed to attach assistant message id to course job',
            error,
          );
        }

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
