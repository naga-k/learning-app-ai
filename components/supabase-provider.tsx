'use client';

import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createContext, useContext, useMemo, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type SupabaseContextValue = {
  supabase: SupabaseClient;
  session: Session | null;
  setSession: (session: Session | null) => void;
};

const SupabaseContext = createContext<SupabaseContextValue | undefined>(undefined);

type SupabaseProviderProps = {
  children: React.ReactNode;
  initialSession: Session | null;
};

export function SupabaseProvider({ children, initialSession }: SupabaseProviderProps) {
  const [supabase] = useState(createBrowserSupabaseClient);
  const [session, setSession] = useState<Session | null>(initialSession);

  const value = useMemo(
    () => ({
      supabase,
      session,
      setSession,
    }),
    [session, supabase],
  );

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};
