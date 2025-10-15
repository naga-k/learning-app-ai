"use server";

import { DASHBOARD_COURSES_PAGE_SIZE } from "@/lib/dashboard/config";
import {
  countCoursesForUser,
  listCoursesForDashboard,
} from "@/lib/db/operations";

type DashboardCourseRow = Awaited<ReturnType<typeof listCoursesForDashboard>>[number];

export type DashboardCourse = {
  id: string;
  topic: string;
  description: string | null;
  createdAt: string;
  sessionId: string | null;
  modulesCount: number | null;
  totalDuration: string | null;
};

export type DashboardCourseCursor = {
  updatedAt: string;
  id: string;
};

export type DashboardCoursePage = {
  courses: DashboardCourse[];
  nextCursor: DashboardCourseCursor | null;
  totalCount: number;
};

const toDashboardCourse = (
  row: DashboardCourseRow,
): { course: DashboardCourse; updatedAt: Date } => {
  const createdAt = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
  const updatedAt = row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt);
  const structured = row.structured && typeof row.structured === "object" ? row.structured : null;

  const description = (() => {
    if (structured) {
      const overview = (structured as { overview?: unknown }).overview;
      if (overview && typeof overview === "object" && "description" in overview) {
        const overviewDescription = (overview as { description?: unknown }).description;
        if (typeof overviewDescription === "string") {
          const trimmed = overviewDescription.trim();
          if (trimmed.length > 0) return trimmed;
        }
      }
    }
    if (typeof row.summary === "string" && row.summary.trim().length > 0) {
      return row.summary.trim();
    }
    return null;
  })();

  const modulesCount = (() => {
    if (!structured) return null;
    const modules = (structured as { modules?: unknown }).modules;
    if (Array.isArray(modules)) {
      return modules.length;
    }
    return null;
  })();

  const totalDuration = (() => {
    if (!structured) return null;
    const overview = (structured as { overview?: unknown }).overview;
    if (!overview || typeof overview !== "object") return null;
    const overviewDuration = (overview as { totalDuration?: unknown }).totalDuration;
    if (typeof overviewDuration !== "string") return null;
    const trimmed = overviewDuration.trim();
    return trimmed.length > 0 ? trimmed : null;
  })();

  return {
    course: {
      id: row.id,
      topic: row.title,
      description,
      createdAt: createdAt.toISOString(),
      sessionId: row.sessionId ?? null,
      modulesCount,
      totalDuration,
    },
    updatedAt,
  };
};

export async function listDashboardCourses(
  userId: string,
  options: {
    limit?: number;
    cursor?: DashboardCourseCursor | null;
  } = {},
): Promise<DashboardCoursePage> {
  const limit = Math.max(1, Math.min(options.limit ?? DASHBOARD_COURSES_PAGE_SIZE, 50));
  const cursor = options.cursor ?? null;

  const rows = await listCoursesForDashboard(userId, {
    limit: limit + 1,
    cursor: cursor
      ? {
          updatedAt: cursor.updatedAt,
          id: cursor.id,
        }
      : null,
  });

  const processed = rows.map(toDashboardCourse);
  const sliced = processed.slice(0, limit);
  const courses = sliced.map((entry) => entry.course);

  const hasMore = processed.length > sliced.length;
  const nextCursor =
    hasMore && sliced.length > 0
      ? {
          updatedAt: sliced[sliced.length - 1].updatedAt.toISOString(),
          id: sliced[sliced.length - 1].course.id,
        }
      : null;

  const totalCount = await countCoursesForUser(userId);

  return {
    courses,
    nextCursor,
    totalCount,
  };
}
