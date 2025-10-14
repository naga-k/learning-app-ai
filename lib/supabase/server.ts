import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.',
  );
}

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

const mapRequestCookies = (store: Awaited<ReturnType<typeof cookies>>) =>
  store.getAll().map(({ name, value }) => ({ name, value }));

export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: async () => mapRequestCookies(cookieStore),
      setAll: async () => {},
    },
  });
};

export const createSupabaseRouteClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: async () => mapRequestCookies(cookieStore),
      setAll: async () => {},
    },
  });
};
