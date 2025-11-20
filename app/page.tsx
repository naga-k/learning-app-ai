import { redirect } from 'next/navigation';
import { LandingPage } from '@/components/landing/landing-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is authenticated, redirect to dashboard
  if (user) {
    redirect('/dashboard');
  }

  // Otherwise, show the landing page
  return <LandingPage />;
}
