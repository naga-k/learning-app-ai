import { redirect } from 'next/navigation';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listDashboardCourses } from '@/lib/dashboard/courses';
import { listDashboardSessions } from '@/lib/dashboard/sessions';
import { getUserAnalytics } from '@/lib/db/operations';
import {
  DASHBOARD_COURSES_PAGE_SIZE,
  DASHBOARD_SESSIONS_PAGE_SIZE,
} from '@/lib/dashboard/config';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [coursePage, sessionPage, analytics] = await Promise.all([
    listDashboardCourses(user.id),
    listDashboardSessions(user.id),
    getUserAnalytics(user.id),
  ]);

  return (
    <DashboardView
      initialCourses={coursePage.courses}
      initialCourseNextCursor={coursePage.nextCursor}
      initialCourseTotalCount={coursePage.totalCount}
      coursePageSize={DASHBOARD_COURSES_PAGE_SIZE}
      initialSessions={sessionPage.sessions}
      initialNextCursor={sessionPage.nextCursor}
      sessionPageSize={DASHBOARD_SESSIONS_PAGE_SIZE}
      initialAnalytics={analytics}
    />
  );
}
