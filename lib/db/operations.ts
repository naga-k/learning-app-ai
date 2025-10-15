"use server";

import { and, count, desc, eq, lt, or, sql } from "drizzle-orm";
import { db } from "./client";
import {
  chatMessages,
  chatSessions,
  courseVersions,
  courses,
} from "./schema";

export type StoredMessage = {
  id: string;
  role: string;
  content: unknown;
  createdAt: Date;
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
    .values({ userId, title: title ?? null })
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

  const updateData: { updatedAt: Date; title?: string | null } = {
    updatedAt: new Date(),
  };

  if (params.role === "user") {
    const message = params.content as { parts?: Array<{ type: string; text?: string }> };
    const textPart = message?.parts?.find((part) => part.type === "text");
    if (textPart?.text) {
      updateData.title = textPart.text.slice(0, 120);
    }
  }

  await db
    .update(chatSessions)
    .set(updateData)
    .where(eq(chatSessions.id, params.sessionId));
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
    })
    .from(courses)
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
