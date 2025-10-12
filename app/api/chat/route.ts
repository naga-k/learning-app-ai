import { openai } from '@ai-sdk/openai';
import { streamText, generateText, convertToModelMessages } from 'ai';
import { z } from 'zod';
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

export const runtime = 'edge';

const webSearchTool = openai.tools.webSearch({
  searchContextSize: 'high',
});

// Allow streaming responses up to 30 seconds

export async function POST(req: Request) {
  const { messages } = await req.json();
  let latestStructuredPlan: LearningPlanWithIds | null = null;

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
        const planGeneration = await generateText({
          model: openai('gpt-5-mini'),
          prompt: planningPrompt,
          tools: {
            web_search: webSearchTool,
          },
          providerOptions: {
            openai: {
              reasoningEffort: 'low',
              textVerbosity: 'medium',
            },
          },
        });

        const planJsonText = extractJsonFromText(planGeneration.text);
        const parsedPlan = JSON.parse(planJsonText);
        const planObject = LearningPlanSchema.parse(parsedPlan);

        console.log('[generate_plan] Personalized plan generated successfully!');
        const elapsedMs = Date.now() - startTime;

        const structuredPlan = normalizeLearningPlan(planObject);
        latestStructuredPlan = structuredPlan;
        const planText = formatLearningPlanText(structuredPlan);

        return {
          plan: planText,
          structuredPlan,
          summary: `Created a personalized learning plan tailored to your specific goals and context`,
          startedAt: startTime,
          durationMs: elapsedMs,
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
      planStructure: z.string().nullable().optional(),
    }),
    execute: async ({
      fullContext,
      planStructure,
    }: {
      fullContext: string;
      planStructure?: string | null;
    }) => {
      console.log('[generate_course] Creating personalized course with context length:', fullContext.length);

      let parsedPlan: LearningPlanWithIds | null = null;

      if (planStructure) {
        try {
          const json = JSON.parse(planStructure);
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
        const courseGeneration = await generateText({
          model: openai('gpt-5-mini'),
          prompt: coursePrompt,
          tools: {
            web_search: webSearchTool,
          },
          providerOptions: {
            openai: {
              reasoningEffort: 'low',
              textVerbosity: 'high',
            },
          },
        });

        const courseJsonText = extractJsonFromText(courseGeneration.text);
        const parsedCourse = JSON.parse(courseJsonText);
        const courseObject = CourseSchema.parse(parsedCourse);

        const structuredCourse = normalizeCourse(courseObject, parsedPlan);
        const courseSummary = summarizeCourseForChat(structuredCourse);

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
        console.error('[generate_course] failed after ms:', Date.now() - startTime, error);
        throw error instanceof Error ? error : new Error(String(error));
      }
    },
  };

  // ------------------------------
  // Main Agent (GPT-5-mini)
  // ------------------------------
  const result = streamText({
    model: openai('gpt-5-mini'),
    system: systemPrompt,
    messages: convertToModelMessages(messages),
    tools: {
      generate_plan: generatePlanTool,
      generate_course: generateCourseTool,
    },
    providerOptions: {
      openai: {
        reasoningEffort: 'low',
        textVerbosity: 'low',
        parallelToolCalls: false,
      },
    },
  });

  return result.toUIMessageStreamResponse();
}