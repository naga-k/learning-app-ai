import { redirect } from 'next/navigation';
import { AuthPageContent } from '@/components/auth/auth-page-content';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/');
  }

  return <AuthPageContent />;
}
