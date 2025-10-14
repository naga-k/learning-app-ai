'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';

export function SupabaseListener() {
  const router = useRouter();
  const { supabase, setSession } = useSupabase();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      fetch('/auth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ event, session }),
      }).finally(() => router.refresh());
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, setSession, supabase]);

  return null;
}
