import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listDashboardCourses } from '@/lib/dashboard/courses';
import { DASHBOARD_COURSES_PAGE_SIZE } from '@/lib/dashboard/config';

const MAX_LIMIT = 50;

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const cursorUpdatedAt = searchParams.get('cursorUpdatedAt');
  const cursorId = searchParams.get('cursorId');

  let limit = Number.parseInt(limitParam ?? '', 10);
  if (Number.isNaN(limit) || limit <= 0) {
    limit = DASHBOARD_COURSES_PAGE_SIZE;
  }
  limit = Math.min(Math.max(limit, 1), MAX_LIMIT);

  const cursor =
    cursorUpdatedAt && cursorId
      ? {
          updatedAt: cursorUpdatedAt,
          id: cursorId,
        }
      : null;

  const result = await listDashboardCourses(user.id, {
    limit,
    cursor,
  });

  return NextResponse.json(result);
}
