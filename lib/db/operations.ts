"use server";

import { and, count, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
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
