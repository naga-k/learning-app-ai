import { z } from 'zod';
import {
    LearningPlanSchema,
    formatLearningPlanText,
    normalizeLearningPlan,
} from '@/lib/curriculum';
import { extractJsonFromText } from '@/lib/ai/json';
import { buildLearningPlanPrompt } from '@/lib/prompts/plan';
import { generateJsonWithRetry } from './utils';

export const createGeneratePlanTool = ({
    model,
    webSearchTools,
    providerOptions,
}: {
    model: any;
    webSearchTools?: any;
    providerOptions?: any;
}) => ({
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
        console.log(
            '[generate_plan] Creating personalized plan with context length:',
            fullConversationContext.length,
        );

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
                model,
                tools: webSearchTools,
                providerOptions,
                parse: (text) => {
                    const planJsonText = extractJsonFromText(text);
                    const parsedPlan = JSON.parse(planJsonText);
                    return LearningPlanSchema.parse(parsedPlan);
                },
            });

            console.log('[generate_plan] Personalized plan generated successfully!');
            const elapsedMs = Date.now() - startTime;

            const structuredPlan = normalizeLearningPlan(planObject);
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
            console.error(
                '[generate_plan] failed after ms:',
                Date.now() - startTime,
                error,
            );
            throw error instanceof Error ? error : new Error(String(error));
        }
    },
});
