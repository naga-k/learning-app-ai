import {
  claimNextCourseGenerationJobForWorker,
  getCourseGenerationJob,
  markCourseGenerationJobCompleted,
  markCourseGenerationJobFailed,
  requeueStaleCourseGenerationJobs,
  saveCourseVersion,
  updateCourseGenerationJobHeartbeat,
  upsertCourseGenerationSnapshot,
  replaceCourseEngagementBlocks,
  type CourseGenerationJobRecord,
} from "@/lib/db/operations";
import { mergeCourseToolOutputIntoMessage } from "@/lib/chat/messages";
import {
  CourseSchema,
  normalizeCourse,
  summarizeCourseForChat,
  type CourseEngagementBlockWithIds,
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
import { generateText } from "ai";
import {
  activeAIProvider,
  activeAIProviderName,
  getModel,
  supportsOpenAIWebSearch,
} from "@/lib/ai/provider";
import { z } from "zod";
import { EngagementBlockArraySchema } from "@/lib/ai/tools/types";
import {
  executeEngagementTools,
  resolveEngagementBlocksFromResults,
  type ToolInvocation,
} from "@/lib/ai/tools/execution";
import { InMemoryToolRegistry, type ToolExecutionContext } from "@/lib/ai/tools/registry";
import {
  generateCodeExerciseTool,
  generateEssayTool,
  generateFillInBlankTool,
  generateMatchingTool,
} from "@/lib/ai/tools/engagement-tools";
import { isProgrammingDomain } from "@/lib/ai/tools/utils";

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

const MAX_ENGAGEMENT_BLOCKS = 3;

const createEngagementToolRegistry = () => {
  const registry = new InMemoryToolRegistry();
  registry.register(generateCodeExerciseTool);
  registry.register(generateFillInBlankTool);
  registry.register(generateMatchingTool);
  registry.register(generateEssayTool);
  return registry;
};

type EngagementToolInputs = {
  moduleTitle: string;
  lessonTitle: string;
  domain?: string;
  summary?: string | null;
  content?: string | null;
};

const buildEngagementToolInvocations = ({
  moduleTitle,
  lessonTitle,
  domain,
  summary,
  content,
}: EngagementToolInputs): ToolInvocation[] => {
  const lessonFocus = (summary ?? content ?? "").trim();
  const fallbackFocus =
    lessonFocus.length > 0
      ? lessonFocus
      : `the core idea of "${lessonTitle}" in module "${moduleTitle}"`;

  const basePrompt = `Ground this activity in ${fallbackFocus}`;

  const invocations: ToolInvocation[] = [
    {
      name: "generate_fill_in_blank",
      input: {
        prompt: `Fill in the missing key phrases from "${lessonTitle}".`,
        blanks: [
          {
            id: "blank-1",
            correctAnswer: lessonTitle,
            alternatives: [moduleTitle],
          },
          {
            id: "blank-2",
            correctAnswer: fallbackFocus.slice(0, 60) || moduleTitle,
          },
        ],
        caseSensitive: false,
      },
    },
    {
      name: "generate_matching",
      input: {
        prompt: `Match lesson concepts for "${lessonTitle}".`,
        leftItems: [
          { id: "left-1", label: "Key idea" },
          { id: "left-2", label: "Practical step" },
        ],
        rightItems: [
          { id: "right-1", label: lessonTitle },
          { id: "right-2", label: moduleTitle },
        ],
        correctPairs: [
          { leftId: "left-1", rightId: "right-1" },
          { leftId: "left-2", rightId: "right-2" },
        ],
      },
    },
    {
      name: "generate_essay_prompt",
      input: {
        prompt: `Write a short reflection connecting "${lessonTitle}" to your work.`,
        guidance: "Focus on how you will apply this lesson this week.",
        minWords: 80,
        maxWords: 200,
        enableAIFeedback: true,
      },
    },
  ];

  if (isProgrammingDomain(domain)) {
    invocations.unshift({
      name: "generate_code_exercise",
      input: {
        prompt: `Implement a small code exercise that demonstrates "${lessonTitle}".`,
        language: "javascript",
        starterCode: "// Start from this scaffold\n",
        hints: [
          "Keep the solution under 30 lines.",
          "Include a quick inline example or test call.",
        ],
      },
    });
  }

  return invocations;
};

const courseProviderOptions = isOpenAIProvider
  ? {
      openai: {
        reasoningEffort: "low",
        textVerbosity: "high",
      },
    }
  : undefined;

const isPersistableEngagementBlock = (
  block: CourseEngagementBlockWithIds | null | undefined,
): block is CourseEngagementBlockWithIds =>
  Boolean(
    block &&
      typeof block.id === "string" &&
      block.id.length > 0 &&
      typeof block.revision === "number" &&
      Number.isFinite(block.revision) &&
      typeof block.contentHash === "string" &&
      block.contentHash.length > 0,
  );

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

type CourseGenerationJobPayload = {
  fullContext?: string;
  planNormalized?: LearningPlanWithIds | null;
  metadata?: Record<string, unknown>;
};

type GenerateJsonWithRetryParams<T> = {
  prompt: string;
  parse: (text: string) => T;
};

async function generateJsonWithRetry<T>({
  prompt,
  parse,
}: GenerateJsonWithRetryParams<T>): Promise<T> {
  const attempt = async (effectivePrompt: string) => {
    const generation = await generateText({
      model: getModel("course"),
      prompt: effectivePrompt,
      tools: webSearchTools,
      providerOptions: courseProviderOptions,
    });

    return parse(generation.text);
  };

  try {
    return await attempt(prompt);
  } catch (error) {
    const needsReminder =
      error instanceof Error
        ? /json/i.test(error.message) || /could not extract valid json/i.test(error.message)
        : false;

    if (!needsReminder) {
      throw error;
    }

    return attempt(`${prompt}\n\nReminder: Respond with valid JSON matching the schema.`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function processJob(job: CourseGenerationJobRecord, workerId: string) {
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
          const overviewResult = await generateJsonWithRetry<CourseOverviewResult>({
            prompt: buildCourseOverviewPrompt({
              fullContext,
              plan,
            }),
            parse: (text) => {
              try {
                const overviewJsonText = extractJsonFromText(text);
                const parsedOverview = JSON.parse(overviewJsonText);

                console.log("[course.generate] Overview JSON before validation", {
                  jobId: job.id,
                  workerId,
                  isArray: Array.isArray(parsedOverview),
                  type: typeof parsedOverview,
                  keys:
                    typeof parsedOverview === "object" && !Array.isArray(parsedOverview)
                      ? Object.keys(parsedOverview).sort()
                      : "N/A",
                  rawJsonPreview: JSON.stringify(parsedOverview).substring(0, 500),
                });

                return CourseOverviewResultSchema.parse(parsedOverview);
              } catch (parseError) {
                console.error("[course.generate] Overview parse FAILED", {
                  jobId: job.id,
                  workerId,
                  error: parseError instanceof Error ? parseError.message : String(parseError),
                  errorStack: parseError instanceof Error ? parseError.stack : undefined,
                });
                throw parseError;
              }
            },
          });

          if (!plan) {
            throw new Error("Plan is required for plan-driven pipeline.");
          }

          const planWithIds = plan as LearningPlanWithIds;
          const modulesWithIds = planWithIds.modules as LearningPlanModuleWithIds[];
          type NormalizedResource = CourseResource & { url: string };

          const aggregatedResources: NormalizedResource[] = [];
          const MAX_RESOURCE_COUNT = 3;
          const normalizeResource = (resource: CourseResource): NormalizedResource | null => {
            const title = resource.title?.trim();
            const url = resource.url?.trim();
            if (!title || !url) return null;
            if (!/^https?:\/\//i.test(url)) return null;
            const description = resource.description?.trim();
            const type = resource.type?.trim();
            return {
              title,
              url,
              ...(description ? { description } : {}),
              ...(type ? { type } : {}),
            } as NormalizedResource;
          };
          const addResourceIfValid = (resource: CourseResource) => {
            const normalized = normalizeResource(resource);
            if (normalized) {
              aggregatedResources.push(normalized);
            }
          };
          const selectResources = (resources: CourseResource[]) => {
            const seen = new Set<string>();
            const filtered: NormalizedResource[] = [];
            for (const resource of resources) {
              const normalized = normalizeResource(resource);
              if (!normalized) continue;
              const key = `${normalized.title.toLowerCase()}|${normalized.url.toLowerCase()}`;
              if (seen.has(key)) continue;
              seen.add(key);
              filtered.push(normalized);
              if (filtered.length >= MAX_RESOURCE_COUNT) break;
            }
            return filtered;
          };

          if (Array.isArray(overviewResult.resources)) {
            overviewResult.resources.forEach(addResourceIfValid);
          }
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
              resources: selectResources(aggregatedResources),
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

          const engagementToolRegistry = createEngagementToolRegistry();

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

              const submoduleResult = await generateJsonWithRetry<CourseSubmoduleResult>({
                prompt: buildCourseSubmodulePrompt({
                  fullContext,
                  plan: planWithIds,
                  module: planModule,
                  subtopic,
                  completedLessonsSummary: completionSummary,
                }),
                parse: (text) => {
                  try {
                    const submoduleJsonText = extractJsonFromText(text);
                    let parsedSubmodule = JSON.parse(submoduleJsonText);

                    console.log("[course.generate] Submodule JSON before validation", {
                      jobId: job.id,
                      workerId,
                      module: planModule.title,
                      submodule: subtopic.title,
                      isArray: Array.isArray(parsedSubmodule),
                      type: typeof parsedSubmodule,
                      keys:
                        typeof parsedSubmodule === "object" && !Array.isArray(parsedSubmodule)
                          ? Object.keys(parsedSubmodule).sort()
                          : "N/A",
                      arrayLength: Array.isArray(parsedSubmodule)
                        ? parsedSubmodule.length
                        : "N/A",
                      rawJsonPreview: JSON.stringify(parsedSubmodule).substring(0, 500),
                    });

                    if (Array.isArray(parsedSubmodule)) {
                      console.warn(
                        "[course.generate] Detected array response for lesson; converting to fallback object",
                        {
                          jobId: job.id,
                          workerId,
                          module: planModule.title,
                          submodule: subtopic.title,
                          arrayLength: parsedSubmodule.length,
                        },
                      );

                      const arrayValue = parsedSubmodule;
                      const looksLikeResources = arrayValue.every((entry) => {
                        if (!entry || typeof entry !== "object") return false;
                        const candidate = entry as Record<string, unknown>;
                        return (
                          typeof candidate.title === "string" ||
                          typeof candidate.url === "string" ||
                          typeof candidate.type === "string"
                        );
                      });

                      const looksLikeStrings = arrayValue.every((entry) => typeof entry === "string");

                      const fallback: CourseSubmoduleResult = {
                        content: `## ${subtopic.title}\n\n_Content could not be generated. Please regenerate this lesson._`,
                        summary: subtopic.description,
                      };

                      if (looksLikeResources) {
                        fallback.recommendedResources = arrayValue as CourseResource[];
                      } else if (looksLikeStrings && arrayValue.length > 0) {
                        const items = arrayValue
                          .map((entry) => (entry as string).trim())
                          .filter(Boolean);
                        if (items.length > 0) {
                          fallback.content = `${fallback.content}\n\n- ${items.join("\n- ")}`;
                        }
                      }

                      parsedSubmodule = fallback;
                    }

                    return CourseSubmoduleResultSchema.parse(parsedSubmodule);
                  } catch (parseError) {
                    const errorMsg =
                      parseError instanceof Error ? parseError.message : String(parseError);
                    console.error("[course.generate] Submodule parse FAILED", {
                      jobId: job.id,
                      workerId,
                      module: planModule.title,
                      submodule: subtopic.title,
                      error: errorMsg,
                      errorStack: parseError instanceof Error ? parseError.stack : undefined,
                      zodError:
                        parseError instanceof Error && parseError.cause
                          ? parseError.cause
                          : undefined,
                    });
                    throw parseError;
                  }
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

              const toolInvocations = buildEngagementToolInvocations({
                moduleTitle: planModule.title,
                lessonTitle: subtopic.title,
                domain: toolContext.domain,
                summary: submoduleResult.summary ?? subtopic.description,
                content: submoduleResult.content,
              });

              const toolResolution = await executeEngagementTools({
                invocations: toolInvocations,
                registry: engagementToolRegistry,
                context: toolContext,
              });

              let engagementBlocks = Array.isArray(
                submoduleResult.engagementBlocks,
              )
                ? submoduleResult.engagementBlocks
                : [];

              let engagementSource: "model" | "tool" | "fallback" = "model";

              if (engagementBlocks.length === 0) {
                engagementBlocks = toolResolution.blocks;
                engagementSource = toolResolution.usedFallback ? "fallback" : "tool";
              } else {
                const existingTypes = new Set(engagementBlocks.map((block) => block.type));
                const supplemental = toolResolution.blocks.filter(
                  (block) => !existingTypes.has(block.type),
                );
                if (supplemental.length > 0) {
                  engagementBlocks = [...engagementBlocks, ...supplemental].slice(
                    0,
                    MAX_ENGAGEMENT_BLOCKS,
                  );
                  engagementSource = "tool";
                }
              }

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
                  addResourceIfValid(resource);
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
            conclusionResult = await generateJsonWithRetry<CourseConclusionResult>({
              prompt: buildCourseConclusionPrompt({
                fullContext,
                plan: planWithIds,
                courseHighlights,
              }),
              parse: (text) => {
                try {
                  const conclusionJsonText = extractJsonFromText(text);
                  const parsedConclusion = JSON.parse(conclusionJsonText);

                  console.log("[course.generate] Conclusion JSON before validation", {
                    jobId: job.id,
                    workerId,
                    isArray: Array.isArray(parsedConclusion),
                    type: typeof parsedConclusion,
                    keys:
                      typeof parsedConclusion === "object" && !Array.isArray(parsedConclusion)
                        ? Object.keys(parsedConclusion).sort()
                        : "N/A",
                    rawJsonPreview: JSON.stringify(parsedConclusion).substring(0, 500),
                  });

                  return CourseConclusionResultSchema.parse(parsedConclusion);
                } catch (parseError) {
                  console.error("[course.generate] Conclusion parse FAILED", {
                    jobId: job.id,
                    workerId,
                    error: parseError instanceof Error ? parseError.message : String(parseError),
                    errorStack: parseError instanceof Error ? parseError.stack : undefined,
                  });
                  throw parseError;
                }
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
            resources: selectResources(aggregatedResources),
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

          return generateJsonWithRetry({
            prompt: coursePrompt,
            parse: (text) => {
              try {
                console.log("[course.generate] Model response received (fallback)", {
                  jobId: job.id,
                  elapsedMs: Date.now() - startTime,
                  workerId,
                });
                const courseJsonText = extractJsonFromText(text);
                const parsedCourse = JSON.parse(courseJsonText);

                console.log("[course.generate] Full course JSON before validation (fallback)", {
                  jobId: job.id,
                  workerId,
                  isArray: Array.isArray(parsedCourse),
                  type: typeof parsedCourse,
                  keys:
                    typeof parsedCourse === "object" && !Array.isArray(parsedCourse)
                      ? Object.keys(parsedCourse).sort()
                      : "N/A",
                  rawJsonPreview: JSON.stringify(parsedCourse).substring(0, 500),
                });

                return CourseSchema.parse(parsedCourse);
              } catch (parseError) {
                console.error("[course.generate] Course parse FAILED (fallback)", {
                  jobId: job.id,
                  workerId,
                  error: parseError instanceof Error ? parseError.message : String(parseError),
                  errorStack: parseError instanceof Error ? parseError.stack : undefined,
                });
                throw parseError;
              }
            },
          });
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

    let engagementOrder = 0;
    const engagementBlocksToPersist = structuredCourse.modules.flatMap((module) =>
      module.submodules.flatMap((submodule) => {
        const blocks = (submodule.engagementBlocks ?? []).filter(
          isPersistableEngagementBlock,
        );

        return blocks.map((block) => ({
          blockId: block.id,
          blockType: block.type,
          blockOrder: ++engagementOrder,
          blockRevision: block.revision,
          contentHash: block.contentHash,
          submoduleId: submodule.id,
          payload: block,
        }));
      }),
    );

    await replaceCourseEngagementBlocks({
      courseVersionId: versionId,
      blocks: engagementBlocksToPersist,
    });

    const engagementBlockSummaries = engagementBlocksToPersist.map((block) => ({
      blockId: block.blockId,
      blockType: block.blockType,
      blockRevision: block.blockRevision,
      contentHash: block.contentHash,
      submoduleId: block.submoduleId,
    }));

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
          courseId,
          courseVersionId: versionId,
          engagementBlocks: engagementBlockSummaries,
        },
      });
    }

    console.log("[course.generate] Job completed", {
      jobId: job.id,
      elapsedMs: Date.now() - startTime,
      workerId,
    });
  } catch (error) {
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
