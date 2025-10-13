import { redirect } from 'next/navigation';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listDashboardCourses } from '@/lib/dashboard/courses';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const courses = await listDashboardCourses();

  return <DashboardView courses={courses} />;
}
