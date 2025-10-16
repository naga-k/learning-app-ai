import {
  claimNextCourseGenerationJobForWorker,
  getCourseGenerationJob,
  markCourseGenerationJobCompleted,
  markCourseGenerationJobFailed,
  requeueStaleCourseGenerationJobs,
  saveCourseVersion,
  updateCourseGenerationJobHeartbeat,
  type CourseGenerationJobRecord,
} from "@/lib/db/operations";
import { mergeCourseToolOutputIntoMessage } from "@/lib/chat/messages";
import {
  CourseSchema,
  normalizeCourse,
  summarizeCourseForChat,
  type LearningPlanWithIds,
} from "@/lib/curriculum";
import { buildCoursePrompt } from "@/lib/prompts/course";
import { extractJsonFromText } from "@/lib/ai/json";
import { generateText } from "ai";
import {
  activeAIProvider,
  activeAIProviderName,
  getModel,
  supportsOpenAIWebSearch,
} from "@/lib/ai/provider";

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

    const coursePrompt = buildCoursePrompt({
      fullContext,
      plan,
    });

    const courseObject = await generateJsonWithRetry({
      prompt: coursePrompt,
      parse: (text) => {
        console.log("[course.generate] Model response received", {
          jobId: job.id,
          elapsedMs: Date.now() - startTime,
          workerId,
        });
        const courseJsonText = extractJsonFromText(text);
        const parsedCourse = JSON.parse(courseJsonText);
        return CourseSchema.parse(parsedCourse);
      },
    });

    const structuredCourse = normalizeCourse(courseObject, plan ?? undefined);
    const courseSummary = summarizeCourseForChat(structuredCourse);

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
