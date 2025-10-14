import { redirect } from 'next/navigation';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listDashboardCourses } from '@/lib/dashboard/courses';
import { listDashboardSessions } from '@/lib/dashboard/sessions';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [courses, sessions] = await Promise.all([
    listDashboardCourses(user.id),
    listDashboardSessions(user.id),
  ]);

  return <DashboardView courses={courses} sessions={sessions} />;
}
