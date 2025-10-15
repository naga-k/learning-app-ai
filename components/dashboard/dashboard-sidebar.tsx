'use client';

import { useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Brain, LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSupabase } from '@/components/supabase-provider';

type DashboardSidebarProps = {
  children?: ReactNode;
  width?: number;
};

export function DashboardSidebar({ children, width }: DashboardSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { supabase } = useSupabase();

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
  }, [router, supabase]);

  const computedWidth = width ?? 256;
  const sidebarStyle: CSSProperties = {
    width: computedWidth,
    minWidth: computedWidth,
  };

  const hasCustomContent = Boolean(children);

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-slate-800 bg-slate-950 text-slate-300",
        hasCustomContent ? "p-0" : "px-6 py-8",
      )}
      style={sidebarStyle}
    >
      {hasCustomContent ? (
        <div className="flex h-full w-full flex-col overflow-hidden">{children}</div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="mb-8 flex items-center gap-3 rounded-xl border border-transparent px-0 py-0 text-left transition hover:border-slate-800 hover:bg-slate-900/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-500">
              <Brain className="size-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Course Architect</p>
              <p className="text-xs text-slate-400">AI Learning Platform</p>
            </div>
          </button>

          <div className="mb-6 h-px bg-slate-800" />

          <div className="flex-1 overflow-y-auto pr-1">
            <nav className="space-y-2">
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-3 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-slate-300 hover:border-slate-800 hover:bg-slate-900/80 hover:text-slate-100',
                  pathname === '/dashboard' && 'border-slate-700 bg-slate-900 text-slate-100',
                )}
                onClick={() => router.push('/dashboard')}
              >
                <LayoutDashboard className="size-4" />
                Dashboard
              </Button>
            </nav>

            {children ? <div className="mt-6">{children}</div> : null}
          </div>

          <div className="mt-6 h-px bg-slate-800" />

          <div className="space-y-2">
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-slate-100"
              disabled
            >
              <Settings className="size-4" />
              Settings
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-900/70 hover:!text-slate-100"
              onClick={handleSignOut}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}
