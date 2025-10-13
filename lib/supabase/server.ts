import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseSecretKey) {
  throw new Error(
    'Missing Supabase environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SECRET_KEY are set.',
  );
}

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;
export const SUPABASE_SECRET_KEY = supabaseSecretKey;

const mapRequestCookies = (store: Awaited<ReturnType<typeof cookies>>) =>
  store.getAll().map(({ name, value }) => ({ name, value }));

export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseSecretKey, {
    cookies: {
      getAll: async () => mapRequestCookies(cookieStore),
      setAll: async () => {},
    },
  });
};

export const createSupabaseRouteClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseSecretKey, {
    cookies: {
      getAll: async () => mapRequestCookies(cookieStore),
      setAll: async () => {},
    },
  });
};
