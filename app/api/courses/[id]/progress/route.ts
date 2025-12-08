import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCourseProgress,
  getCourseWithActiveVersion,
  updateCourseProgress,
} from "@/lib/db/operations";

type RouteParams = {
  params: { id: string };
};

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const courseId = params.id;
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required" }, { status: 400 });
  }

  const record = await getCourseWithActiveVersion({
    courseId,
    userId: user.id,
  });

  if (!record || !record.course || !record.version) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const progress = await getCourseProgress({
    userId: user.id,
    courseId: record.course.id,
    courseVersionId: record.version.id,
    structured: record.version.structured,
  });

  return NextResponse.json(progress);
}

export async function POST(request: Request, { params }: RouteParams) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const courseId = params.id;
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required" }, { status: 400 });
  }

  const record = await getCourseWithActiveVersion({
    courseId,
    userId: user.id,
  });

  if (!record || !record.course || !record.version) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const submoduleId = body?.submoduleId;

  if (!submoduleId || typeof submoduleId !== "string") {
    return NextResponse.json({ error: "submoduleId is required" }, { status: 400 });
  }

  const allowedStatuses = ["not_started", "in_progress", "completed"] as const;
  const status =
    typeof body?.status === "string" && allowedStatuses.includes(body.status)
      ? body.status
      : undefined;

  const timeSpentSecondsDelta =
    typeof body?.timeSpentSecondsDelta === "number" ? body.timeSpentSecondsDelta : undefined;
  const timeSpentSeconds =
    typeof body?.timeSpentSeconds === "number" ? body.timeSpentSeconds : undefined;

  const lastAccessedAt =
    typeof body?.lastAccessedAt === "string" || body?.lastAccessedAt instanceof Date
      ? new Date(body.lastAccessedAt)
      : undefined;
  const completedAt =
    typeof body?.completedAt === "string" || body?.completedAt instanceof Date
      ? new Date(body.completedAt)
      : body?.completedAt === null
        ? null
        : undefined;

  await updateCourseProgress({
    userId: user.id,
    courseId: record.course.id,
    courseVersionId: record.version.id,
    submoduleId,
    status,
    timeSpentSecondsDelta,
    timeSpentSeconds,
    lastAccessedAt,
    completedAt,
  });

  const progress = await getCourseProgress({
    userId: user.id,
    courseId: record.course.id,
    courseVersionId: record.version.id,
    structured: record.version.structured,
  });

  return NextResponse.json(progress);
}
