"use server";

import { listCoursesForDashboard } from "@/lib/db/operations";

type DashboardCourseRow = Awaited<ReturnType<typeof listCoursesForDashboard>>[number];

export type DashboardCourse = {
  id: string;
  topic: string;
  durationMinutes: number;
  createdAt: string;
  completed: boolean;
  progress: number;
};

export async function listDashboardCourses(userId: string): Promise<DashboardCourse[]> {
  const rows = await listCoursesForDashboard(userId);

  return rows.map((row: DashboardCourseRow) => {
    const createdAt = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
    return {
      id: row.id,
      topic: row.title,
      durationMinutes: row.duration ?? 0,
      createdAt: createdAt.toISOString(),
      completed: (row.progress ?? 0) >= 100,
      progress: row.progress ?? 0,
    };
  });
}
