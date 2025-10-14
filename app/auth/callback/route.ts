import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/server';

const createSupabaseWithResponse = async <T extends NextResponse>(response: T) => {
  const cookieStore = await cookies();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

  return { supabase, response };
};

const resolveRedirectUrl = (request: Request) => {
  const requestUrl = new URL(request.url);
  const defaultRedirect = '/dashboard';
  const redirectPath =
    requestUrl.searchParams.get('next') ??
    requestUrl.searchParams.get('redirect_to') ??
    defaultRedirect;

  const redirectUrl = new URL(redirectPath, requestUrl.origin);

  if (redirectUrl.origin !== requestUrl.origin) {
    return new URL(defaultRedirect, requestUrl.origin);
  }

  return redirectUrl;
};

export async function GET(request: Request) {
  const redirectUrl = resolveRedirectUrl(request);
  const { supabase, response } = await createSupabaseWithResponse(
    NextResponse.redirect(redirectUrl),
  );

  const requestUrl = new URL(request.url);
  const errorDescription = requestUrl.searchParams.get('error_description');
  const code = requestUrl.searchParams.get('code');

  if (errorDescription) {
    redirectUrl.searchParams.set('error', errorDescription);
    response.headers.set('Location', redirectUrl.toString());
    return response;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      redirectUrl.searchParams.set('error', error.message);
      response.headers.set('Location', redirectUrl.toString());
    }
  }

  return response;
}

export async function POST(request: Request) {
  const { supabase, response } = await createSupabaseWithResponse(
    NextResponse.json({ success: true }),
  );

  const { event, session } = await request.json();

  if (event === 'SIGNED_OUT') {
    await supabase.auth.signOut();
  } else if (session) {
    await supabase.auth.setSession(session);
  }

  return response;
}
