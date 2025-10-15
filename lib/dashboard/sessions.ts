"use server";

import { listRecentChatSessions } from "@/lib/db/operations";
import { DASHBOARD_SESSIONS_PAGE_SIZE } from "@/lib/dashboard/config";

export type DashboardSession = {
  id: string;
  title: string | null;
  updatedAt: string;
  createdAt: string;
  hasGeneratedCourse: boolean;
};

export type DashboardSessionCursor = {
  updatedAt: string;
  id: string;
};

export type DashboardSessionPage = {
  sessions: DashboardSession[];
  nextCursor: DashboardSessionCursor | null;
};

const toDashboardSession = (row: {
  id: string;
  title: string | null;
  updatedAt: Date | string;
  createdAt: Date | string;
  hasGeneratedCourse: unknown;
}): DashboardSession => {
  const updatedAt = row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt);
  const createdAt = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);

  return {
    id: row.id,
    title: row.title ?? "Untitled session",
    updatedAt: updatedAt.toISOString(),
    createdAt: createdAt.toISOString(),
    hasGeneratedCourse: Boolean(row.hasGeneratedCourse),
  };
};

export async function listDashboardSessions(
  userId: string,
  options: {
    limit?: number;
    cursor?: DashboardSessionCursor | null;
  } = {},
): Promise<DashboardSessionPage> {
  const limit = Math.max(1, Math.min(options.limit ?? DASHBOARD_SESSIONS_PAGE_SIZE, 50));
  const cursor = options.cursor ?? null;

  const rows = await listRecentChatSessions(userId, {
    limit: limit + 1,
    cursor: cursor
      ? {
          updatedAt: cursor.updatedAt,
          id: cursor.id,
        }
      : null,
  });

  const mapped = rows.map(toDashboardSession);
  const sessions = mapped.slice(0, limit);

  const hasMore = mapped.length > sessions.length;
  const nextCursor =
    hasMore && sessions.length > 0
      ? {
          updatedAt: sessions[sessions.length - 1].updatedAt,
          id: sessions[sessions.length - 1].id,
        }
      : null;

  return {
    sessions,
    nextCursor,
  };
}
