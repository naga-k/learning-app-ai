"use server";

import { randomBytes } from "crypto";
import {
  and,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
  sum,
} from "drizzle-orm";
import { db } from "./client";
import {
  chatMessages,
  chatSessions,
  courseVersions,
  courses,
  courseGenerationJobs,
  courseGenerationSnapshots,
  courseEngagementBlocks,
  courseEngagementResponses,
  courseProgress,
} from "./schema";

export type StoredMessage = {
  id: string;
  role: string;
  content: unknown;
  createdAt: Date;
};

export type CourseEngagementBlockRecord =
  typeof courseEngagementBlocks.$inferSelect;
export type CourseEngagementResponseRecord =
  typeof courseEngagementResponses.$inferSelect;
export type CourseProgressRecord = typeof courseProgress.$inferSelect;

const SHARE_TOKEN_BYTES = 18;

const generateShareToken = () => randomBytes(SHARE_TOKEN_BYTES).toString("base64url");

export type CourseVersionShareStatus = {
  courseId: string;
  shareToken: string | null;
  shareEnabledAt: Date | null;
};

export async function createChatSession({
  userId,
  title,
}: {
  userId: string;
  title?: string | null;
}): Promise<{ id: string }> {
  const [session] = await db
    .insert(chatSessions)
    .values({ userId, title: title ?? 'Untitled session' })
    .returning({ id: chatSessions.id });

  return session;
}

export async function getChatSession(sessionId: string, userId: string) {
  const [session] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);

  return session ?? null;
}

export async function listChatMessages(sessionId: string, userId: string) {
  const session = await getChatSession(sessionId, userId);
  if (!session) return [];

  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);

  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt,
  } satisfies StoredMessage));
}

export async function insertChatMessage(params: {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: unknown;
}) {
  await db
    .insert(chatMessages)
    .values({
      id: params.id,
      sessionId: params.sessionId,
      role: params.role,
      content: params.content,
    })
    .onConflictDoNothing({ target: chatMessages.id });

  await db
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, params.sessionId));
}

export async function updateChatMessageContent(params: {
  id: string;
  sessionId: string;
  content: unknown;
}) {
  await db
    .update(chatMessages)
    .set({ content: params.content })
    .where(and(eq(chatMessages.id, params.id), eq(chatMessages.sessionId, params.sessionId)));

  await db
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, params.sessionId));
}

export async function getChatMessage(messageId: string) {
  const [row] = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, messageId))
    .limit(1);

  return row ?? null;
}

export async function updateChatSessionTitle(params: {
  sessionId: string;
  userId: string;
  title: string;
}) {
  await db
    .update(chatSessions)
    .set({ title: params.title, updatedAt: new Date() })
    .where(and(eq(chatSessions.id, params.sessionId), eq(chatSessions.userId, params.userId)));
}

export async function saveCourseVersion(params: {
  userId: string;
  sessionId?: string | null;
  title: string;
  summary: string | null;
  structured: unknown;
}) {
  const [course] = await db
    .insert(courses)
    .values({
      userId: params.userId,
      sessionId: params.sessionId ?? null,
      title: params.title,
    })
    .returning();

  const [version] = await db
    .insert(courseVersions)
    .values({
      courseId: course.id,
      summary: params.summary,
      structured: params.structured,
    })
    .returning();

  await db
    .update(courses)
    .set({ activeVersionId: version.id, updatedAt: new Date() })
    .where(eq(courses.id, course.id));

  return { courseId: course.id, versionId: version.id };
}

export async function replaceCourseEngagementBlocks(params: {
  courseVersionId: string;
  blocks: {
    blockId: string;
    blockType: string;
    blockOrder: number;
    blockRevision: number;
    contentHash: string;
    submoduleId: string;
    payload: unknown;
  }[];
}) {
  await db.transaction(async (tx) => {
    await tx
      .delete(courseEngagementBlocks)
      .where(eq(courseEngagementBlocks.courseVersionId, params.courseVersionId));

    if (params.blocks.length === 0) {
      return;
    }

    await tx.insert(courseEngagementBlocks).values(
      params.blocks.map((block) => ({
        courseVersionId: params.courseVersionId,
        blockId: block.blockId,
        blockType: block.blockType,
        blockOrder: block.blockOrder,
        blockRevision: block.blockRevision,
        contentHash: block.contentHash,
        submoduleId: block.submoduleId,
        payload: block.payload,
        updatedAt: new Date(),
      })),
    );
  });
}

export async function listCourseEngagementBlocks(params: {
  courseVersionId: string;
}) {
  const rows = await db
    .select()
    .from(courseEngagementBlocks)
    .where(eq(courseEngagementBlocks.courseVersionId, params.courseVersionId))
    .orderBy(courseEngagementBlocks.blockOrder);

  return rows;
}

export async function listCourseEngagementResponses(params: {
  userId: string;
  courseVersionId: string;
}) {
  const rows = await db
    .select()
    .from(courseEngagementResponses)
    .where(
      and(
        eq(courseEngagementResponses.userId, params.userId),
        eq(courseEngagementResponses.courseVersionId, params.courseVersionId),
      ),
    );

  return rows;
}

export async function upsertCourseEngagementResponse(params: {
  userId: string;
  courseId: string;
  courseVersionId: string;
  blockId: string;
  blockType: string;
  submoduleId: string;
  blockRevision: number;
  contentHash: string;
  response: unknown;
  score?: number | null;
  isCorrect?: boolean | null;
}) {
  await db
    .insert(courseEngagementResponses)
    .values({
      userId: params.userId,
      courseId: params.courseId,
      courseVersionId: params.courseVersionId,
      blockId: params.blockId,
      blockType: params.blockType,
      submoduleId: params.submoduleId,
      blockRevision: params.blockRevision,
      contentHash: params.contentHash,
      response: params.response,
      score: params.score ?? null,
      isCorrect: params.isCorrect ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        courseEngagementResponses.userId,
        courseEngagementResponses.courseVersionId,
        courseEngagementResponses.blockId,
      ],
      set: {
        response: params.response,
        score: params.score ?? null,
        isCorrect: params.isCorrect ?? null,
        blockRevision: params.blockRevision,
        contentHash: params.contentHash,
        updatedAt: new Date(),
      },
    });
}

export async function deleteCourseEngagementResponse(params: {
  userId: string;
  courseVersionId: string;
  blockId: string;
}) {
  await db
    .delete(courseEngagementResponses)
    .where(
      and(
        eq(courseEngagementResponses.userId, params.userId),
        eq(courseEngagementResponses.courseVersionId, params.courseVersionId),
        eq(courseEngagementResponses.blockId, params.blockId),
      ),
    );
}

export async function getCourseVersionForUser(params: {
  courseVersionId: string;
  userId: string;
}) {
  const [row] = await db
    .select({
      version: courseVersions,
      course: courses,
    })
    .from(courseVersions)
    .innerJoin(courses, eq(courseVersions.courseId, courses.id))
    .where(
      and(
        eq(courseVersions.id, params.courseVersionId),
        eq(courses.userId, params.userId),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    version: row.version,
    course: row.course,
  };
}

export async function getCourseVersionShareStatus(params: {
  courseVersionId: string;
  userId: string;
}): Promise<CourseVersionShareStatus | null> {
  const record = await getCourseVersionForUser(params);
  if (!record) return null;

  return {
    courseId: record.course.id,
    shareToken: record.version.shareToken ?? null,
    shareEnabledAt: record.version.shareEnabledAt ?? null,
  };
}

export async function enableCourseVersionShare(params: {
  courseVersionId: string;
  userId: string;
  regenerateToken?: boolean;
}): Promise<CourseVersionShareStatus> {
  const record = await getCourseVersionForUser({
    courseVersionId: params.courseVersionId,
    userId: params.userId,
  });

  if (!record) {
    throw new Error("Course version not found for user.");
  }

  let token =
    !params.regenerateToken && record.version.shareToken
      ? record.version.shareToken
      : generateShareToken();

  // Best-effort uniqueness check; collisions are extraordinarily unlikely.
  if (params.regenerateToken || !record.version.shareToken) {
    let attempts = 0;
    while (attempts < 5) {
      const [existing] = await db
        .select({ id: courseVersions.id })
        .from(courseVersions)
        .where(eq(courseVersions.shareToken, token))
        .limit(1);

      if (!existing) {
        break;
      }

      token = generateShareToken();
      attempts += 1;
    }

    if (attempts >= 5) {
      throw new Error("Unable to generate unique share token.");
    }
  }

  const now = new Date();

  await db
    .update(courseVersions)
    .set({
      shareToken: token,
      shareEnabledAt: now,
    })
    .where(eq(courseVersions.id, params.courseVersionId));

  return {
    courseId: record.course.id,
    shareToken: token,
    shareEnabledAt: now,
  };
}

export async function disableCourseVersionShare(params: {
  courseVersionId: string;
  userId: string;
}): Promise<void> {
  const record = await getCourseVersionForUser({
    courseVersionId: params.courseVersionId,
    userId: params.userId,
  });

  if (!record) {
    throw new Error("Course version not found for user.");
  }

  await db
    .update(courseVersions)
    .set({
      shareToken: null,
      shareEnabledAt: null,
    })
    .where(eq(courseVersions.id, params.courseVersionId));
}

export async function getCourseVersionByShareToken(token: string) {
  if (!token.trim()) return null;

  const [row] = await db
    .select({
      version: courseVersions,
      course: courses,
    })
    .from(courseVersions)
    .innerJoin(courses, eq(courseVersions.courseId, courses.id))
    .where(and(eq(courseVersions.shareToken, token), isNotNull(courseVersions.shareEnabledAt)))
    .limit(1);

  if (!row || !row.version.shareEnabledAt) {
    return null;
  }

  return {
    version: row.version,
    course: row.course,
  };
}

export async function getCourseEngagementBlock(params: {
  courseVersionId: string;
  blockId: string;
}) {
  const [row] = await db
    .select()
    .from(courseEngagementBlocks)
    .where(
      and(
        eq(courseEngagementBlocks.courseVersionId, params.courseVersionId),
        eq(courseEngagementBlocks.blockId, params.blockId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export type CourseGenerationJobRecord =
  typeof courseGenerationJobs.$inferSelect;
export type CourseGenerationSnapshotRecord =
  typeof courseGenerationSnapshots.$inferSelect;

const JOB_STATUS = {
  queued: "queued",
  processing: "processing",
  completed: "completed",
  failed: "failed",
} as const;

export type CourseGenerationJobStatus =
  (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export async function createCourseGenerationJob(params: {
  userId: string;
  sessionId: string;
  payload?: unknown;
}) {
  const [job] = await db
    .insert(courseGenerationJobs)
    .values({
      userId: params.userId,
      sessionId: params.sessionId,
      payload: params.payload ?? null,
    })
    .returning();

  return job;
}

export async function setCourseGenerationJobAssistantMessageId(params: {
  jobId: string;
  assistantMessageId: string;
}) {
  await db
    .update(courseGenerationJobs)
    .set({
      assistantMessageId: params.assistantMessageId,
      updatedAt: new Date(),
    })
    .where(eq(courseGenerationJobs.id, params.jobId));
}

export async function claimNextCourseGenerationJob() {
  return await claimNextCourseGenerationJobForWorker({ workerId: "default-worker" });
}

export async function claimNextCourseGenerationJobForWorker(params: {
  workerId: string;
}) {
  const result = await db.execute(
    sql`with job as (
            select ${courseGenerationJobs.id}
            from ${courseGenerationJobs}
            where ${courseGenerationJobs.status} = ${JOB_STATUS.queued}
            order by ${courseGenerationJobs.createdAt}
            limit 1
            for update skip locked
        )
        update ${courseGenerationJobs}
        set status = ${JOB_STATUS.processing},
            processing_by = ${params.workerId},
            started_at = now(),
            last_heartbeat_at = now(),
            updated_at = now()
        where id = (select id from job)
        returning *`,
  );

  const raw = (result.rows ?? [])[0] as Record<string, unknown> | undefined;
  if (!raw) return null;

  const jobId =
    (raw.id as string | undefined) ??
    (raw["course_generation_jobs.id"] as string | undefined);

  if (!jobId) return null;

  const [job] = await db
    .select()
    .from(courseGenerationJobs)
    .where(eq(courseGenerationJobs.id, jobId))
    .limit(1);

  return job ?? null;
}

export async function markCourseGenerationJobCompleted(params: {
  jobId: string;
  summary: string;
  courseId: string;
  courseVersionId: string;
  courseStructured: unknown;
}) {
  const now = new Date();

  await db
    .update(courseGenerationJobs)
    .set({
      status: JOB_STATUS.completed,
      resultSummary: params.summary,
      resultCourseId: params.courseId,
      resultCourseVersionId: params.courseVersionId,
      resultCourseStructured: params.courseStructured,
      processingBy: null,
      lastHeartbeatAt: now,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(courseGenerationJobs.id, params.jobId));
}

export async function markCourseGenerationJobFailed(params: {
  jobId: string;
  error: string;
}) {
  await db
    .update(courseGenerationJobs)
    .set({
      status: JOB_STATUS.failed,
      error: params.error,
      processingBy: null,
      lastHeartbeatAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date(),
    })
    .where(eq(courseGenerationJobs.id, params.jobId));
}

export async function updateCourseGenerationJobHeartbeat(params: {
  jobId: string;
  workerId: string;
}) {
  await db
    .update(courseGenerationJobs)
    .set({
      lastHeartbeatAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(courseGenerationJobs.id, params.jobId),
        eq(courseGenerationJobs.processingBy, params.workerId),
        eq(courseGenerationJobs.status, JOB_STATUS.processing),
      ),
    );
}

export async function requeueStaleCourseGenerationJobs(params: {
  staleBefore: Date;
}) {
  await db
    .update(courseGenerationJobs)
    .set({
      status: JOB_STATUS.queued,
      processingBy: null,
      startedAt: null,
      lastHeartbeatAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(courseGenerationJobs.status, JOB_STATUS.processing),
        or(
          isNull(courseGenerationJobs.lastHeartbeatAt),
          lt(courseGenerationJobs.lastHeartbeatAt, params.staleBefore),
        ),
      ),
    );
}

export async function getCourseGenerationJob(params: {
  jobId: string;
  userId: string;
}) {
  const [job] = await db
    .select()
    .from(courseGenerationJobs)
    .where(and(eq(courseGenerationJobs.id, params.jobId), eq(courseGenerationJobs.userId, params.userId)))
    .limit(1);

  return job ?? null;
}

export async function upsertCourseGenerationSnapshot(params: {
  jobId: string;
  structuredPartial: unknown;
  moduleProgress?: Record<string, unknown> | null;
}) {
  const now = new Date();

  await db
    .insert(courseGenerationSnapshots)
    .values({
      jobId: params.jobId,
      structuredPartial: params.structuredPartial,
      moduleProgress: params.moduleProgress ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: courseGenerationSnapshots.jobId,
      set: {
        structuredPartial: params.structuredPartial,
        moduleProgress: params.moduleProgress ?? null,
        updatedAt: now,
      },
    });
}

export async function getCourseGenerationSnapshot(jobId: string) {
  const [snapshot] = await db
    .select()
    .from(courseGenerationSnapshots)
    .where(eq(courseGenerationSnapshots.jobId, jobId))
    .limit(1);

  return snapshot ?? null;
}

type CourseCursor = {
  updatedAt: Date | string;
  id: string;
};

export async function listCoursesForDashboard(
  userId: string,
  options: { limit?: number; cursor?: CourseCursor | null } = {},
) {
  const limit = Math.max(1, Math.min(options.limit ?? 9, 100));
  const cursor = options.cursor ?? null;

  const baseCondition = eq(courses.userId, userId);
  const whereClause = cursor
    ? (() => {
        const cursorDate =
          cursor.updatedAt instanceof Date ? cursor.updatedAt : new Date(cursor.updatedAt);
        const cursorCondition = or(
          lt(courses.updatedAt, cursorDate),
          and(eq(courses.updatedAt, cursorDate), lt(courses.id, cursor.id)),
        );

        return and(baseCondition, cursorCondition) ?? baseCondition;
      })()
    : baseCondition;

  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      sessionId: courses.sessionId,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
      summary: courseVersions.summary,
      structured: courseVersions.structured,
    })
    .from(courses)
    .leftJoin(courseVersions, eq(courseVersions.id, courses.activeVersionId))
    .where(whereClause)
    .orderBy(desc(courses.updatedAt), desc(courses.id))
    .limit(limit);

  return rows;
}

export async function countCoursesForUser(userId: string) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(courses)
    .where(eq(courses.userId, userId));

  return Number(value ?? 0);
}

type SessionCursor = {
  updatedAt: Date | string;
  id: string;
};

export async function listRecentChatSessions(
  userId: string,
  options: { limit?: number; cursor?: SessionCursor | null } = {},
) {
  const limit = Math.max(1, Math.min(options.limit ?? 5, 100));
  const cursor = options.cursor ?? null;

  const baseCondition = eq(chatSessions.userId, userId);
  const whereClause = cursor
    ? (() => {
        const cursorDate =
          cursor.updatedAt instanceof Date ? cursor.updatedAt : new Date(cursor.updatedAt);
        const cursorCondition = or(
          lt(chatSessions.updatedAt, cursorDate),
          and(eq(chatSessions.updatedAt, cursorDate), lt(chatSessions.id, cursor.id)),
        );

        return and(baseCondition, cursorCondition) ?? baseCondition;
      })()
    : baseCondition;

  const sessions = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      updatedAt: chatSessions.updatedAt,
      createdAt: chatSessions.createdAt,
      hasGeneratedCourse: sql<boolean>`bool_or(${courses.id} IS NOT NULL)`,
    })
    .from(chatSessions)
    .innerJoin(chatMessages, eq(chatMessages.sessionId, chatSessions.id))
    .leftJoin(courses, eq(courses.sessionId, chatSessions.id))
    .where(whereClause)
    .groupBy(
      chatSessions.id,
      chatSessions.title,
      chatSessions.updatedAt,
      chatSessions.createdAt,
    )
    .orderBy(desc(chatSessions.updatedAt), desc(chatSessions.id))
    .limit(limit);

  return sessions;
}

type CourseStructureStats = {
  totalSubmodules: number;
  modules: {
    moduleId: string;
    title: string;
    submodules: { id: string; title: string | null }[];
  }[];
};

const extractCourseStructureStats = (structured: unknown): CourseStructureStats => {
  const fallback: CourseStructureStats = { totalSubmodules: 0, modules: [] };
  if (!structured || typeof structured !== "object") {
    return fallback;
  }

  const modules = (structured as { modules?: unknown }).modules;
  if (!Array.isArray(modules)) {
    return fallback;
  }

  const parsedModules = modules
    .map((module) => {
      if (!module || typeof module !== "object") return null;
      const moduleId = (module as { moduleId?: unknown }).moduleId;
      const title = (module as { title?: unknown }).title;
      const submodules = (module as { submodules?: unknown }).submodules;
      if (typeof moduleId !== "string") return null;
      if (!Array.isArray(submodules)) return null;

      const parsedSubmodules = submodules
        .map((submodule) => {
          if (!submodule || typeof submodule !== "object") return null;
          const id = (submodule as { id?: unknown }).id;
          const subTitle = (submodule as { title?: unknown }).title;
          if (typeof id !== "string") return null;
          return {
            id,
            title: typeof subTitle === "string" ? subTitle : null,
          };
        })
        .filter(Boolean) as { id: string; title: string | null }[];

      return {
        moduleId,
        title: typeof title === "string" ? title : moduleId,
        submodules: parsedSubmodules,
      };
    })
    .filter(Boolean) as CourseStructureStats["modules"];

  const totalSubmodules = parsedModules.reduce(
    (sum, module) => sum + module.submodules.length,
    0,
  );

  return {
    totalSubmodules,
    modules: parsedModules,
  };
};

export async function getCourseWithActiveVersion(params: {
  courseId: string;
  userId: string;
}) {
  const [row] = await db
    .select({
      course: courses,
      version: courseVersions,
    })
    .from(courses)
    .leftJoin(courseVersions, eq(courseVersions.id, courses.activeVersionId))
    .where(and(eq(courses.id, params.courseId), eq(courses.userId, params.userId)))
    .limit(1);

  if (!row) return null;
  return row;
}

export async function updateCourseProgress(params: {
  userId: string;
  courseId: string;
  courseVersionId: string;
  submoduleId: string;
  status?: "not_started" | "in_progress" | "completed";
  timeSpentSecondsDelta?: number;
  timeSpentSeconds?: number;
  lastAccessedAt?: Date | string | null;
  completedAt?: Date | string | null;
}) {
  const now = new Date();
  const deltaSeconds = Math.max(0, Math.floor(params.timeSpentSecondsDelta ?? 0));
  const lastAccessedAt =
    params.lastAccessedAt === undefined
      ? now
      : params.lastAccessedAt === null
        ? null
        : new Date(params.lastAccessedAt);
  const completedAt =
    params.completedAt === undefined
      ? params.status === "completed"
        ? now
        : undefined
      : params.completedAt === null
        ? null
        : new Date(params.completedAt);

  const updatePayload: Record<string, unknown> = {
    updatedAt: now,
    courseId: params.courseId,
    courseVersionId: params.courseVersionId,
  };

  if (params.status) {
    updatePayload.status = params.status;
  }

  if (lastAccessedAt) {
    updatePayload.lastAccessedAt = lastAccessedAt;
  }

  if (completedAt !== undefined) {
    updatePayload.completedAt = completedAt;
  }

  if (params.timeSpentSeconds !== undefined) {
    updatePayload.timeSpentSeconds = Math.max(0, Math.floor(params.timeSpentSeconds));
  } else if (deltaSeconds > 0) {
    updatePayload.timeSpentSeconds = sql`${courseProgress.timeSpentSeconds} + ${deltaSeconds}`;
  }

  await db
    .insert(courseProgress)
    .values({
      userId: params.userId,
      courseId: params.courseId,
      courseVersionId: params.courseVersionId,
      submoduleId: params.submoduleId,
      status: params.status ?? "in_progress",
      timeSpentSeconds:
        params.timeSpentSeconds !== undefined
          ? Math.max(0, Math.floor(params.timeSpentSeconds))
          : deltaSeconds,
      lastAccessedAt,
      completedAt: completedAt ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        courseProgress.userId,
        courseProgress.courseVersionId,
        courseProgress.submoduleId,
      ],
      set: updatePayload,
    });
}

export async function getCourseProgress(params: {
  userId: string;
  courseId?: string;
  courseVersionId: string;
  structured?: unknown;
}) {
  const rows = await db
    .select()
    .from(courseProgress)
    .where(
      and(
        eq(courseProgress.userId, params.userId),
        eq(courseProgress.courseVersionId, params.courseVersionId),
      ),
    );

  const structureStats = extractCourseStructureStats(params.structured);
  const totalTimeSeconds = rows.reduce(
    (sum, row) => sum + Math.max(0, row.timeSpentSeconds ?? 0),
    0,
  );
  const completedSubmodules = rows.filter((row) => row.status === "completed").length;
  const inProgressSubmodules = rows.filter((row) => row.status === "in_progress").length;
  const lastAccessedAt = rows.reduce<Date | null>((latest, row) => {
    const current = row.lastAccessedAt ? new Date(row.lastAccessedAt) : null;
    if (!current) return latest;
    if (!latest) return current;
    return current > latest ? current : latest;
  }, null);

  const moduleBreakdown = structureStats.modules.map((module) => {
    const completedInModule = module.submodules.filter((submodule) =>
      rows.some(
        (row) => row.submoduleId === submodule.id && row.status === "completed",
      ),
    ).length;

    const inProgressInModule = module.submodules.filter((submodule) =>
      rows.some(
        (row) => row.submoduleId === submodule.id && row.status === "in_progress",
      ),
    ).length;

    return {
      moduleId: module.moduleId,
      title: module.title,
      totalSubmodules: module.submodules.length,
      completedSubmodules: completedInModule,
      inProgressSubmodules: inProgressInModule,
    };
  });

  return {
    progress: rows,
    summary: {
      courseId: params.courseId ?? null,
      courseVersionId: params.courseVersionId,
      totalSubmodules: structureStats.totalSubmodules,
      completedSubmodules,
      inProgressSubmodules,
      completionPercent:
        structureStats.totalSubmodules > 0
          ? Math.round((completedSubmodules / structureStats.totalSubmodules) * 100)
          : 0,
      totalTimeSeconds,
      lastAccessedAt,
    },
    modules: moduleBreakdown,
  };
}

export async function getCourseAnalytics(params: { userId: string; courseId: string }) {
  const record = await getCourseWithActiveVersion({
    courseId: params.courseId,
    userId: params.userId,
  });
  if (!record || !record.course || !record.version) return null;

  const progress = await getCourseProgress({
    userId: params.userId,
    courseId: params.courseId,
    courseVersionId: record.version.id,
    structured: record.version.structured,
  });

  const [engagementStats] = await db
    .select({
      totalResponses: count(),
      correctResponses: sum(
        sql<number>`case when ${courseEngagementResponses.isCorrect} = true then 1 else 0 end`,
      ),
    })
    .from(courseEngagementResponses)
    .where(
      and(
        eq(courseEngagementResponses.userId, params.userId),
        eq(courseEngagementResponses.courseId, params.courseId),
      ),
    );

  const totalResponses = Number(engagementStats?.totalResponses ?? 0);
  const correctResponses = Number(engagementStats?.correctResponses ?? 0);
  const accuracyRate =
    totalResponses > 0 ? Math.round((correctResponses / totalResponses) * 100) : null;

  return {
    courseId: params.courseId,
    courseVersionId: record.version.id,
    progress,
    engagement: {
      totalResponses,
      correctResponses,
      accuracyRate,
    },
  };
}

export async function getUserAnalytics(userId: string) {
  const courseRows = await db
    .select({
      course: courses,
      version: courseVersions,
    })
    .from(courses)
    .leftJoin(courseVersions, eq(courseVersions.id, courses.activeVersionId))
    .where(eq(courses.userId, userId));

  const courseAnalytics = await Promise.all(
    courseRows.map(async (row) => {
      if (!row.course) return null;
      return await getCourseAnalytics({
        userId,
        courseId: row.course.id,
      });
    }),
  );

  const validAnalytics = courseAnalytics.filter(Boolean) as Awaited<
    ReturnType<typeof getCourseAnalytics>
  >[];

  const totalCourses = courseRows.length;
  const completedCourses = validAnalytics.filter(
    (entry) => entry?.progress.summary.completionPercent === 100,
  ).length;
  const totalTimeSeconds = validAnalytics.reduce(
    (sum, entry) => sum + (entry?.progress.summary.totalTimeSeconds ?? 0),
    0,
  );
  const averageCompletion =
    validAnalytics.length > 0
      ? Math.round(
          validAnalytics.reduce(
            (sum, entry) => sum + (entry?.progress.summary.completionPercent ?? 0),
            0,
          ) / validAnalytics.length,
        )
      : 0;
  const latestActivity = validAnalytics.reduce<Date | null>((latest, entry) => {
    const entryDate = entry?.progress.summary.lastAccessedAt
      ? new Date(entry.progress.summary.lastAccessedAt)
      : null;
    if (!entryDate) return latest;
    if (!latest) return entryDate;
    return entryDate > latest ? entryDate : latest;
  }, null);

  return {
    totals: {
      totalCourses,
      completedCourses,
      inProgressCourses: Math.max(0, totalCourses - completedCourses),
      totalTimeSeconds,
      averageCompletionPercent: averageCompletion,
      latestActivity,
    },
    courses: validAnalytics.map((entry) => ({
      courseId: entry?.courseId ?? "",
      courseVersionId: entry?.courseVersionId ?? "",
      completionPercent: entry?.progress.summary.completionPercent ?? 0,
      totalTimeSeconds: entry?.progress.summary.totalTimeSeconds ?? 0,
      totalSubmodules: entry?.progress.summary.totalSubmodules ?? 0,
      completedSubmodules: entry?.progress.summary.completedSubmodules ?? 0,
      accuracyRate: entry?.engagement.accuracyRate ?? null,
      lastAccessedAt: entry?.progress.summary.lastAccessedAt ?? null,
    })),
  };
}
