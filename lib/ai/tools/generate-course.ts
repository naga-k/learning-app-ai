import { z } from 'zod';
import {
    LearningPlanSchema,
    normalizeLearningPlan,
    type LearningPlanWithIds,
    type CourseWithIds,
} from '@/lib/curriculum';
import {
    createCourseGenerationJob,
    markCourseGenerationJobFailed,
} from '@/lib/db/operations';

export const createGenerateCourseTool = ({
    userId,
    sessionId,
    latestStructuredPlan,
}: {
    userId: string;
    sessionId: string;
    latestStructuredPlan?: LearningPlanWithIds | null;
}) => ({
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
        planStructure: z.union([z.string(), z.any()]).nullable().optional(),
    }),
    execute: async ({
        fullContext,
        planStructure,
    }: {
        fullContext: string;
        planStructure?: string | unknown | null;
    }) => {
        console.log(
            '[generate_course] Creating personalized course with context length:',
            fullContext.length,
        );

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

        const enqueueStartTime = Date.now();
        let jobRecord: Awaited<ReturnType<typeof createCourseGenerationJob>> | null =
            null;

        try {
            jobRecord = await createCourseGenerationJob({
                userId,
                sessionId,
                payload: {
                    fullContext,
                    planNormalized: parsedPlan,
                    metadata: {
                        planProvided: Boolean(parsedPlan),
                        moduleCount: parsedPlan?.modules.length ?? 0,
                        createdFrom: 'api/chat/generate_course',
                    },
                },
            });

            const elapsedMs = Date.now() - enqueueStartTime;

            return {
                jobId: jobRecord.id,
                status: 'queued' as const,
                summary:
                    'Course generation is running in the background. I will let you know when it is ready.',
                startedAt: enqueueStartTime,
                durationMs: elapsedMs,
            };
        } catch (error) {
            const elapsedMs = Date.now() - enqueueStartTime;
            console.error('[generate_course] failed to enqueue job', error);

            if (jobRecord) {
                const message =
                    error instanceof Error && error.message
                        ? error.message
                        : typeof error === 'string'
                            ? error
                            : 'Unknown error';
                await markCourseGenerationJobFailed({
                    jobId: jobRecord.id,
                    error: message,
                }).catch((markError) => {
                    console.error(
                        '[generate_course] failed to mark job as failed',
                        markError,
                    );
                });
            }

            let friendlyMessage =
                'Course generation could not be queued. Please try again.';

            if (error instanceof Error) {
                const message = error.message?.trim();
                if (message) {
                    friendlyMessage = `Course generation could not be queued: ${message}`;
                }
            } else if (typeof error === 'string' && error.trim().length > 0) {
                friendlyMessage = `Course generation could not be queued: ${error.trim()}`;
            }

            return {
                errorMessage: friendlyMessage,
                startedAt: enqueueStartTime,
                durationMs: elapsedMs,
            };
        }
    },
});
