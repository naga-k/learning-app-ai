"use server";

import { listCoursesForDashboard } from "@/lib/db/operations";

type DashboardCourseRow = Awaited<ReturnType<typeof listCoursesForDashboard>>[number];

export type DashboardCourse = {
  id: string;
  topic: string;
  createdAt: string;
  sessionId: string | null;
};

export async function listDashboardCourses(userId: string): Promise<DashboardCourse[]> {
  const rows = await listCoursesForDashboard(userId);

  return rows.map((row: DashboardCourseRow) => {
    const createdAt = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
    return {
      id: row.id,
      topic: row.title,
      createdAt: createdAt.toISOString(),
      sessionId: row.sessionId ?? null,
    };
  });
}
