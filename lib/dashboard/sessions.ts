"use server";

import { listRecentChatSessions } from "@/lib/db/operations";

export type DashboardSession = {
  id: string;
  title: string | null;
  updatedAt: string;
  createdAt: string;
  hasGeneratedCourse: boolean;
};

export async function listDashboardSessions(userId: string): Promise<DashboardSession[]> {
  const rows = await listRecentChatSessions(userId, 6);

  return rows.map((row) => {
    const updatedAt = row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt);
    const createdAt = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);

    return {
      id: row.id,
      title: row.title ?? "Untitled session",
      updatedAt: updatedAt.toISOString(),
      createdAt: createdAt.toISOString(),
      hasGeneratedCourse: Boolean(row.hasGeneratedCourse),
    };
  });
}
