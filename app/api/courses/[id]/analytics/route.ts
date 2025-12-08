import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCourseAnalytics } from "@/lib/db/operations";

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

  const analytics = await getCourseAnalytics({
    userId: user.id,
    courseId,
  });

  if (!analytics) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  return NextResponse.json(analytics);
}
