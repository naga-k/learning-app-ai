import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const response = NextResponse.json({ success: true });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    cookies: {
      getAll: async () =>
        cookieStore.getAll().map(({ name, value }) => ({ name, value })),
      setAll: async (setCookies) => {
        setCookies.forEach(({ name, value, options }) => {
          if (value) {
            response.cookies.set({ name, value, ...options });
          } else {
            response.cookies.delete({ name, ...options });
          }
        });
      },
    },
  });

  const { event, session } = await request.json();

  if (event === 'SIGNED_OUT') {
    await supabase.auth.signOut();
  } else if (session) {
    await supabase.auth.setSession(session);
  }

  return response;
}
