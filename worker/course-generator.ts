import {
  claimNextCourseGenerationJobForWorker,
  getCourseGenerationJob,
  markCourseGenerationJobCompleted,
  markCourseGenerationJobFailed,
  requeueStaleCourseGenerationJobs,
  saveCourseVersion,
  updateCourseGenerationJobHeartbeat,
  upsertCourseGenerationSnapshot,
  type CourseGenerationJobRecord,
} from "@/lib/db/operations";
import { mergeCourseToolOutputIntoMessage } from "@/lib/chat/messages";
import {
  CourseSchema,
  normalizeCourse,
  summarizeCourseForChat,
  type LearningPlanModuleWithIds,
  type LearningPlanWithIds,
} from "@/lib/curriculum";
import {
  buildCourseConclusionPrompt,
  buildCourseOverviewPrompt,
  buildCourseSubmodulePrompt,
  buildCoursePrompt,
} from "@/lib/prompts/course";
import { extractJsonFromText } from "@/lib/ai/json";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import {
  activeAIProvider,
  activeAIProviderName,
  getModel,
  supportsOpenAIWebSearch,
} from "@/lib/ai/provider";
import { z } from "zod";
import { EngagementBlockArraySchema } from "@/lib/ai/tools/types";
import { resolveEngagementBlocksFromResults } from "@/lib/ai/tools/execution";
import type { ToolExecutionContext } from "@/lib/ai/tools/registry";

const requiredEnvVars = ["SUPABASE_DB_URL", "OPENAI_API_KEY", "AI_PROVIDER"];

requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    console.warn("[course.generate] Warning: missing env var", key);
  }
});

const isOpenAIProvider = activeAIProviderName === "openai";

const webSearchTool = supportsOpenAIWebSearch
  ? activeAIProvider.tools.webSearch({
      searchContextSize: "high",
    })
  : undefined;

const webSearchTools = webSearchTool ? { web_search: webSearchTool } : undefined;

const courseProviderOptions = isOpenAIProvider
  ? {
      openai: {
        reasoningEffort: "low",
        textVerbosity: "high",
      },
    }
  : undefined;

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
  engagementBlocks: EngagementBlockArraySchema.optional(),
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
type LearningPlanSubtopicWithIds = LearningPlanModuleWithIds["subtopics"][number];

const IDLE_DELAY_MS = Number(process.env.COURSE_GENERATION_WORKER_IDLE_MS ?? "3000");
const ERROR_DELAY_MS = Number(process.env.COURSE_GENERATION_WORKER_ERROR_MS ?? "5000");
const HEARTBEAT_INTERVAL_MS = Math.max(
  1000,
  Number(process.env.COURSE_GENERATION_HEARTBEAT_MS ?? "45000"),
);
const STALE_TIMEOUT_MS = Math.max(
  HEARTBEAT_INTERVAL_MS * 2,
  Number(process.env.COURSE_GENERATION_STALE_TIMEOUT_MS ?? "180000"),
);
const REQUEUE_INTERVAL_MS = Math.max(
  HEARTBEAT_INTERVAL_MS,
  Number(process.env.COURSE_GENERATION_REQUEUE_INTERVAL_MS ?? "60000"),
);
const WORKER_CONCURRENCY = Math.max(
  1,
  Number(process.env.COURSE_GENERATION_WORKER_CONCURRENCY ?? "3"),
);

const JSON_REMINDER = "Reminder: Respond with valid JSON matching the schema.";
const MAX_JSON_JOB_ATTEMPTS = Math.max(
  1,
  Number(process.env.COURSE_GENERATION_JSON_JOB_ATTEMPTS ?? "2"),
);

type CourseGenerationJobPayload = {
  fullContext?: string;
  planNormalized?: LearningPlanWithIds | null;
  metadata?: Record<string, unknown>;
};

class CourseJsonStructureError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "CourseJsonStructureError";
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }

  cause?: unknown;
}

type StructuredGenerationParams<TValue, TResult = TValue> = {
  prompt: string;
  schema: z.ZodType<TValue>;
  logLabel: string;
  logMeta: Record<string, unknown>;
  transform?: (value: TValue) => TResult;
  fallbackParse?: (rawText: string) => Promise<unknown> | unknown;
};

function safeJsonPreview(value: unknown) {
  try {
    return JSON.stringify(value).substring(0, 500);
  } catch {
    return "[unserializable]";
  }
}

function isLikelyJsonError(error: unknown): boolean {
  if (error == null) return false;
  if (NoObjectGeneratedError.isInstance?.(error)) return true;
  if (error instanceof Error) {
    if (/json/i.test(error.message)) return true;
    if (error.cause && isLikelyJsonError(error.cause)) return true;
  }
  return false;
}

function extractErrorText(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if ("text" in error && typeof (error as { text?: unknown }).text === "string") {
    return (error as { text: string }).text;
  }

  if (error instanceof Error && error.cause) {
    return extractErrorText(error.cause);
  }

  return null;
}

async function generateStructuredWithRetry<TValue, TResult = TValue>({
  prompt,
  schema,
  logLabel,
  logMeta,
  transform,
  fallbackParse,
}: StructuredGenerationParams<TValue, TResult>): Promise<TResult> {
  const prompts = [prompt, `${prompt}\n\n${JSON_REMINDER}`];
  let lastError: unknown;

  const applyTransform = (value: TValue): TResult =>
    (transform ? transform(value) : (value as unknown as TResult));

  const logStructured = (value: unknown, attempt: number) => {
    const baseLog = {
      ...logMeta,
      attempt,
      isArray: Array.isArray(value),
      type: typeof value,
      keys:
        typeof value === "object" && value !== null && !Array.isArray(value)
          ? Object.keys(value as Record<string, unknown>).sort()
          : "N/A",
      rawJsonPreview: safeJsonPreview(value),
    };
    console.log(`[course.generate] ${logLabel}`, baseLog);
  };

  for (let attemptIndex = 0; attemptIndex < prompts.length; attemptIndex += 1) {
    const effectivePrompt = prompts[attemptIndex];

    try {
      const generation = await generateText({
        model: getModel("course"),
        prompt: effectivePrompt,
        tools: webSearchTools,
        providerOptions: courseProviderOptions,
        experimental_output: Output.object({ schema }),
      });

      const parsed = generation.experimental_output;
      logStructured(parsed, attemptIndex + 1);
      return applyTransform(parsed);
    } catch (error) {
      lastError = error;

      if (!isLikelyJsonError(error)) {
        throw error;
      }

      const rawText = extractErrorText(error);
      if (rawText && fallbackParse) {
        try {
          const fallbackValue = await fallbackParse(rawText);
          if (fallbackValue != null) {
            const validated = schema.parse(fallbackValue as unknown);
            console.warn(`[course.generate] ${logLabel} repaired via fallback parse`, {
              ...logMeta,
              attempt: attemptIndex + 1,
            });
            logStructured(validated, attemptIndex + 1);
            return applyTransform(validated);
          }
        } catch (fallbackError) {
          lastError = fallbackError;
          console.error(`[course.generate] ${logLabel} fallback parse failed`, {
            ...logMeta,
            attempt: attemptIndex + 1,
            error: fallbackError instanceof Error ? fallbackError.message : fallbackError,
          });
        }
      }

      if (attemptIndex < prompts.length - 1) {
        console.warn(`[course.generate] ${logLabel} retrying after JSON error`, {
          ...logMeta,
          attempt: attemptIndex + 1,
          error: error instanceof Error ? error.message : error,
        });
        continue;
      }
    }
  }

  const causeMessage =
    lastError instanceof Error
      ? lastError.message
      : typeof lastError === "string"
        ? lastError
        : null;

  const failureMessage = causeMessage
    ? `${logLabel} generation failed due to invalid JSON output: ${causeMessage}`
    : `${logLabel} generation failed due to invalid JSON output.`;

  throw new CourseJsonStructureError(failureMessage, {
    cause: lastError,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function processJob(
  job: CourseGenerationJobRecord,
  workerId: string,
  attempt = 1,
) {
  const payload = (job.payload ?? {}) as CourseGenerationJobPayload;
  const fullContext = typeof payload.fullContext === "string" ? payload.fullContext : null;
  const planPayload = payload.planNormalized ?? null;
  const plan =
    planPayload && typeof planPayload === "object"
      ? (planPayload as LearningPlanWithIds)
      : null;

  if (!fullContext) {
    await markCourseGenerationJobFailed({
      jobId: job.id,
      error: "Job payload is missing fullContext.",
    });
    return;
  }

  const startTime = Date.now();

  console.log("[course.generate] Processing job", {
    jobId: job.id,
    userId: job.userId,
    sessionId: job.sessionId,
    planProvided: Boolean(plan),
    contextLength: fullContext.length,
    workerId,
    attempt,
    maxAttempts: MAX_JSON_JOB_ATTEMPTS,
  });

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  let assistantMessageId = job.assistantMessageId ?? null;

  const getAssistantMessageId = async () => {
    if (assistantMessageId) return assistantMessageId;

    const refreshed = await getCourseGenerationJob({
      jobId: job.id,
      userId: job.userId,
    });

    assistantMessageId = refreshed?.assistantMessageId ?? null;
    return assistantMessageId;
  };

  try {
    await updateCourseGenerationJobHeartbeat({
      jobId: job.id,
      workerId,
    });

    heartbeatTimer = setInterval(() => {
      updateCourseGenerationJobHeartbeat({
        jobId: job.id,
        workerId,
      }).catch((error) => {
        console.error("[course.generate] Failed to update heartbeat", {
          jobId: job.id,
          workerId,
          error,
        });
      });
    }, HEARTBEAT_INTERVAL_MS);

    const usePlanDrivenPipeline = Boolean(plan);

    const courseObject = usePlanDrivenPipeline
      ? await (async () => {
          console.log("[course.generate] Generating course overview", {
            jobId: job.id,
            workerId,
          });
          const overviewResult = await generateStructuredWithRetry({
            prompt: buildCourseOverviewPrompt({
              fullContext,
              plan,
            }),
            schema: CourseOverviewResultSchema,
            logLabel: "Overview JSON before validation",
            logMeta: { jobId: job.id, workerId },
            fallbackParse: (rawText) => {
              const overviewJsonText = extractJsonFromText(rawText);
              if (!overviewJsonText) return null;
              return JSON.parse(overviewJsonText);
            },
          });

          if (!plan) {
            throw new Error("Plan is required for plan-driven pipeline.");
          }

          const planWithIds = plan as LearningPlanWithIds;
          const modulesWithIds = planWithIds.modules as LearningPlanModuleWithIds[];
          const aggregatedResources: CourseResource[] = [
            ...(overviewResult.resources ?? []),
          ];
          const generatedSubmodules = new Map<string, CourseSubmoduleResult>();
          const engagementDiagnostics = new Map<
            string,
            { source: "model" | "tool" | "fallback"; blockCount: number }
          >();
          const completedLessonLabels: string[] = [];
          const totalSubmodules = modulesWithIds.reduce(
            (sum, moduleWithIds) => sum + moduleWithIds.subtopics.length,
            0,
          );

          const dedupeResources = (resources: CourseResource[]) => {
            if (resources.length === 0) return [];

            const seen = new Set<string>();
            const result: CourseResource[] = [];

            resources.forEach((resource) => {
              const key = `${resource.title.trim().toLowerCase()}|${(resource.url ?? "").trim().toLowerCase()}`;
              if (seen.has(key)) return;
              seen.add(key);
              result.push(resource);
            });

            return result;
          };

          const publishPartialSnapshot = async ({
            conclusionResult,
          }: {
            conclusionResult: CourseConclusionResult | null;
          }) => {
            const readySubmoduleIds = new Set(generatedSubmodules.keys());
            const partialCourse = CourseSchema.parse({
              overview: {
                title: overviewResult.title,
                description: overviewResult.description,
                focus: overviewResult.focus ?? undefined,
                totalDuration: planWithIds.overview.totalDuration,
              },
              modules: modulesWithIds.map((moduleWithIds) => {
            const subtopicsWithIds =
              moduleWithIds.subtopics as LearningPlanSubtopicWithIds[];

                return {
                  moduleId: moduleWithIds.id,
                  title: moduleWithIds.title,
                  summary: moduleWithIds.objective,
                  submodules: subtopicsWithIds.map((subtopicWithIds) => {
                    const subtopicId = subtopicWithIds.id;
                    const generated = generatedSubmodules.get(subtopicId);
                    const fallbackContent = [
                      `## ${subtopicWithIds.title}`,
                      "",
                      "_This lesson is still generating. Check back shortly._",
                    ].join("\n");

                    return {
                      id: subtopicId,
                      title: subtopicWithIds.title,
                      duration: subtopicWithIds.duration ?? undefined,
                      content: generated?.content ?? fallbackContent,
                      summary: generated?.summary ?? subtopicWithIds.description,
                      engagementBlocks: generated?.engagementBlocks ?? undefined,
                    };
                  }),
                };
              }),
              resources: dedupeResources(aggregatedResources),
              conclusion: conclusionResult ?? undefined,
            });

            const partialWithIds = normalizeCourse(partialCourse, planWithIds);
            const moduleProgress = {
              overviewReady: true,
              conclusionReady: Boolean(conclusionResult),
              totalSubmodules,
              readySubmodules: readySubmoduleIds.size,
              modules: modulesWithIds.map((moduleWithIds) => {
                const subtopicsWithIds =
                  moduleWithIds.subtopics as LearningPlanSubtopicWithIds[];

                return {
                  moduleId: moduleWithIds.id,
                  readyCount: subtopicsWithIds.filter((subtopicWithIds) =>
                    readySubmoduleIds.has(subtopicWithIds.id),
                  ).length,
                  totalCount: subtopicsWithIds.length,
                  submodules: subtopicsWithIds.map((subtopicWithIds) => ({
                    id: subtopicWithIds.id,
                    ready: readySubmoduleIds.has(subtopicWithIds.id),
                  })),
                };
              }),
            };

            await upsertCourseGenerationSnapshot({
              jobId: job.id,
              structuredPartial: partialWithIds,
              moduleProgress,
            });

            const messageId = await getAssistantMessageId();
            if (messageId) {
              await mergeCourseToolOutputIntoMessage({
                messageId,
                updates: {
                  jobId: job.id,
                  status: "processing",
                  courseStructured: partialWithIds,
                  course: summarizeCourseForChat(partialWithIds),
                  summary: "Generating your personalized course…",
                  moduleProgress,
                },
              });
            }
          };

          await publishPartialSnapshot({ conclusionResult: null });

          for (const planModule of modulesWithIds) {
            const subtopicsWithIds =
              planModule.subtopics as LearningPlanSubtopicWithIds[];

            for (const subtopic of subtopicsWithIds) {
              const completionSummary = completedLessonLabels.length
                ? completedLessonLabels
                    .map((label, index) => `${index + 1}. ${label}`)
                    .join("\n")
                : "";

              console.log("[course.generate] Generating lesson", {
                jobId: job.id,
                workerId,
                module: planModule.title,
                submodule: subtopic.title,
              });

              const submoduleResult = await generateStructuredWithRetry<CourseSubmoduleResult>({
                prompt: buildCourseSubmodulePrompt({
                  fullContext,
                  plan: planWithIds,
                  module: planModule,
                  subtopic,
                  completedLessonsSummary: completionSummary,
                }),
                schema: CourseSubmoduleResultSchema,
                logLabel: "Submodule JSON before validation",
                logMeta: {
                  jobId: job.id,
                  workerId,
                  module: planModule.title,
                  submodule: subtopic.title,
                },
                fallbackParse: (rawText) => {
                  const submoduleJsonText = extractJsonFromText(rawText);
                  if (!submoduleJsonText) return null;
                  const parsed = JSON.parse(submoduleJsonText);
                  if (Array.isArray(parsed)) {
                    const looksLikeResources =
                      parsed.length > 0 &&
                      typeof parsed[0] === "object" &&
                      parsed[0] !== null &&
                      ("title" in parsed[0] || "url" in parsed[0] || "type" in parsed[0]);
                    return {
                      content: `## ${subtopic.title}\n\n_Content could not be generated. Please regenerate this lesson._`,
                      summary: subtopic.description,
                      recommendedResources: looksLikeResources ? parsed : undefined,
                    };
                  }
                  return parsed;
                },
              });

              const toolContext: ToolExecutionContext = {
                moduleTitle: planModule.title,
                lessonTitle: subtopic.title,
                domain:
                  typeof payload.metadata?.domain === "string"
                    ? payload.metadata.domain
                    : planWithIds.overview.goal,
                learnerLevel:
                  typeof payload.metadata?.learnerLevel === "string"
                    ? payload.metadata.learnerLevel
                    : undefined,
              };

              let engagementBlocks = Array.isArray(
                submoduleResult.engagementBlocks,
              )
                ? submoduleResult.engagementBlocks
                : [];

              let engagementSource: "model" | "tool" | "fallback" = "model";

              if (engagementBlocks.length === 0) {
                const resolution = resolveEngagementBlocksFromResults(
                  [],
                  toolContext,
                );
                engagementBlocks = resolution.blocks;
                engagementSource = resolution.usedFallback ? "fallback" : "tool";
              }

              engagementDiagnostics.set(subtopic.id, {
                source: engagementBlocks.length > 0 ? engagementSource : "fallback",
                blockCount: engagementBlocks.length,
              });

              console.log("[course.generate] Engagement blocks resolved", {
                jobId: job.id,
                workerId,
                module: planModule.title,
                lesson: subtopic.title,
                source: engagementSource,
                blockCount: engagementBlocks.length,
              });

              generatedSubmodules.set(subtopic.id, {
                ...submoduleResult,
                engagementBlocks,
              });
              if (Array.isArray(submoduleResult.recommendedResources)) {
                submoduleResult.recommendedResources.forEach((resource) => {
                  aggregatedResources.push(resource);
                });
              }

              completedLessonLabels.push(`${planModule.title} — ${subtopic.title}`);

              await publishPartialSnapshot({ conclusionResult: null });
            }
          }

          const engagementSummary = Array.from(engagementDiagnostics.values()).reduce(
            (acc, { source }) => {
              acc[source] = (acc[source] ?? 0) + 1;
              return acc;
            },
            {} as Record<"model" | "tool" | "fallback", number>,
          );

          console.log("[course.generate] Engagement summary", {
            jobId: job.id,
            workerId,
            summary: engagementSummary,
          });

          let conclusionResult: CourseConclusionResult | null = null;
          const courseHighlights = completedLessonLabels.length
            ? completedLessonLabels
                .map((label, index) => `${index + 1}. ${label}`)
                .join("\n")
            : "No lessons were generated in this draft.";

          try {
            console.log("[course.generate] Generating course conclusion", {
              jobId: job.id,
              workerId,
            });
            conclusionResult = await generateStructuredWithRetry({
              prompt: buildCourseConclusionPrompt({
                fullContext,
                plan: planWithIds,
                courseHighlights,
              }),
              schema: CourseConclusionResultSchema,
              logLabel: "Conclusion JSON before validation",
              logMeta: { jobId: job.id, workerId },
              fallbackParse: (rawText) => {
                const conclusionJsonText = extractJsonFromText(rawText);
                if (!conclusionJsonText) return null;
                return JSON.parse(conclusionJsonText);
              },
            });
          } catch (conclusionError) {
            console.warn(
              "[course.generate] Conclusion generation failed; proceeding without conclusion.",
              {
                jobId: job.id,
                workerId,
                error: conclusionError,
              },
            );
            conclusionResult = null;
          }

          await publishPartialSnapshot({ conclusionResult });

          const validated = CourseSchema.parse({
            overview: {
              title: overviewResult.title,
              description: overviewResult.description,
              focus: overviewResult.focus ?? undefined,
              totalDuration: planWithIds.overview.totalDuration,
            },
            modules: modulesWithIds.map((moduleWithIds) => {
                const subtopicsWithIds =
                  moduleWithIds.subtopics as LearningPlanSubtopicWithIds[];

              return {
                moduleId: moduleWithIds.id,
                title: moduleWithIds.title,
                summary: moduleWithIds.objective,
                submodules: subtopicsWithIds.map((subtopicWithIds) => {
                  const subtopicId = subtopicWithIds.id;
                  const generated = generatedSubmodules.get(subtopicId);
                  const fallbackContent = [
                    `## ${subtopicWithIds.title}`,
                    "",
                    "Content is currently unavailable. Please regenerate this lesson.",
                  ].join("\n");

                  return {
                    id: subtopicId,
                    title: subtopicWithIds.title,
                    duration: subtopicWithIds.duration ?? undefined,
                    content: generated?.content ?? fallbackContent,
                    summary: generated?.summary ?? subtopicWithIds.description,
                    engagementBlocks: generated?.engagementBlocks ?? undefined,
                  };
                }),
              };
            }),
            resources: dedupeResources(aggregatedResources),
            conclusion: conclusionResult ?? undefined,
          });

          return validated;
        })()
      : await (async () => {
          console.warn("[course.generate] No plan provided—falling back to single prompt generation.", {
            jobId: job.id,
            workerId,
          });
          const coursePrompt = buildCoursePrompt({
            fullContext,
            plan: null,
          });

          const courseResult = await generateStructuredWithRetry({
            prompt: coursePrompt,
            schema: CourseSchema,
            logLabel: "Full course JSON before validation (fallback)",
            logMeta: { jobId: job.id, workerId },
            fallbackParse: (rawText) => {
              const courseJsonText = extractJsonFromText(rawText);
              if (!courseJsonText) return null;
              return JSON.parse(courseJsonText);
            },
          });

          console.log("[course.generate] Model response received (fallback)", {
            jobId: job.id,
            elapsedMs: Date.now() - startTime,
            workerId,
          });

          return courseResult;
        })();

    const structuredCourse = normalizeCourse(courseObject, plan ?? undefined);
    const courseSummary = summarizeCourseForChat(structuredCourse);
    const finalModuleProgress = {
      overviewReady: true,
      conclusionReady: Boolean(
        structuredCourse.conclusion &&
          (structuredCourse.conclusion.summary ||
            structuredCourse.conclusion.celebrationMessage ||
            (structuredCourse.conclusion.recommendedNextSteps ?? []).length > 0 ||
            (structuredCourse.conclusion.stretchIdeas ?? []).length > 0),
      ),
      totalSubmodules: structuredCourse.modules.reduce(
        (sum, module) => sum + module.submodules.length,
        0,
      ),
      readySubmodules: structuredCourse.modules.reduce(
        (sum, module) => sum + module.submodules.length,
        0,
      ),
      modules: structuredCourse.modules.map((module) => ({
        moduleId: module.moduleId,
        readyCount: module.submodules.length,
        totalCount: module.submodules.length,
        submodules: module.submodules.map((submodule) => ({
          id: submodule.id,
          ready: true,
        })),
      })),
    };

    await upsertCourseGenerationSnapshot({
      jobId: job.id,
      structuredPartial: structuredCourse,
      moduleProgress: finalModuleProgress,
    });

    const courseTitle =
      structuredCourse.overview?.title?.trim() ??
      structuredCourse.overview?.focus?.trim() ??
      structuredCourse.modules[0]?.title ??
      "Personalised course";

    const { courseId, versionId } = await saveCourseVersion({
      userId: job.userId,
      sessionId: job.sessionId,
      title: courseTitle,
      summary: courseSummary,
      structured: structuredCourse,
    });

    console.log("[course.generate] Course saved", {
      jobId: job.id,
      courseId,
      versionId,
      elapsedMs: Date.now() - startTime,
      workerId,
    });

    await markCourseGenerationJobCompleted({
      jobId: job.id,
      summary: courseSummary,
      courseId,
      courseVersionId: versionId,
      courseStructured: structuredCourse,
    });

    const refreshedJob = await getCourseGenerationJob({
      jobId: job.id,
      userId: job.userId,
    });

    if (refreshedJob?.assistantMessageId) {
      await mergeCourseToolOutputIntoMessage({
        messageId: refreshedJob.assistantMessageId,
        updates: {
          jobId: job.id,
          status: "completed",
          course: courseSummary,
          courseStructured: structuredCourse,
          summary: `Generated your personalized course with content tailored to your specific goals and needs`,
          startedAt: startTime,
          durationMs: Date.now() - startTime,
          moduleProgress: finalModuleProgress,
        },
      });
    }

    console.log("[course.generate] Job completed", {
      jobId: job.id,
      elapsedMs: Date.now() - startTime,
      workerId,
    });
  } catch (error) {
    if (error instanceof CourseJsonStructureError && attempt < MAX_JSON_JOB_ATTEMPTS) {
      console.warn("[course.generate] Job attempt failed due to JSON output; retrying", {
        jobId: job.id,
        workerId,
        attempt,
        nextAttempt: attempt + 1,
        error: error.message,
      });
      return processJob(job, workerId, attempt + 1);
    }

    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
    console.error("[course.generate] Job failed", {
      jobId: job.id,
      error: message,
      elapsedMs: Date.now() - startTime,
      workerId,
    });

    await markCourseGenerationJobFailed({
      jobId: job.id,
      error: message,
    });

    const refreshedJob = await getCourseGenerationJob({
      jobId: job.id,
      userId: job.userId,
    });

    if (refreshedJob?.assistantMessageId) {
      await mergeCourseToolOutputIntoMessage({
        messageId: refreshedJob.assistantMessageId,
        updates: {
          jobId: job.id,
          status: "failed",
          summary: `Course generation failed: ${message}`,
          course: `Course generation failed: ${message}`,
        },
      });
    }
  }
  finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
  }
}

async function startWorkerLoop(workerId: string) {
  console.log("[course.generate] Worker started", { workerId });
  while (true) {
    try {
      const job = await claimNextCourseGenerationJobForWorker({ workerId });

      if (!job) {
        await sleep(IDLE_DELAY_MS);
        continue;
      }

      await processJob(job, workerId);
    } catch (error) {
      console.error("[course.generate] Worker iteration failed", {
        workerId,
        error,
      });
      await sleep(ERROR_DELAY_MS);
    }
  }
}

async function startWorker() {
  const baseWorkerId = `${process.env.RENDER_INSTANCE_ID ?? process.env.HOSTNAME ?? "worker"}-${
    process.pid
  }`;

  await requeueStaleCourseGenerationJobs({
    staleBefore: new Date(Date.now() - STALE_TIMEOUT_MS),
  });

  const requeueTimer = setInterval(() => {
    requeueStaleCourseGenerationJobs({
      staleBefore: new Date(Date.now() - STALE_TIMEOUT_MS),
    }).catch((error) => {
      console.error("[course.generate] Failed to requeue stale jobs", error);
    });
  }, REQUEUE_INTERVAL_MS);

  try {
    await Promise.all(
      Array.from({ length: WORKER_CONCURRENCY }, (_, index) => {
        const workerId = `${baseWorkerId}-${index + 1}`;
        return startWorkerLoop(workerId).catch((error) => {
          console.error("[worker] failed to run worker loop", { workerId, error });
          throw error;
        });
      }),
    );
  } finally {
    clearInterval(requeueTimer);
  }
}

void startWorker().catch((error) => {
  console.error("[worker] fatal error", error);
  process.exit(1);
});
