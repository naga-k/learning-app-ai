'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar';
import {
  SidebarPortal,
  SidebarProvider,
  useSidebarState,
} from '@/components/dashboard/sidebar-provider';
import { cn } from '@/lib/utils';

const DEFAULT_SIDEBAR_WIDTH = 420;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 640;

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <AuthenticatedLayoutFrame>{children}</AuthenticatedLayoutFrame>
    </SidebarProvider>
  );
}

function AuthenticatedLayoutFrame({
  children,
}: {
  children: ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  const { widthOverride } = useSidebarState();

  const effectiveSidebarWidth = widthOverride ?? sidebarWidth;

  const layoutStyle = useMemo(
    () =>
      ({
        '--sidebar-width': `${effectiveSidebarWidth}px`,
      }) as CSSProperties,
    [effectiveSidebarWidth],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (widthOverride !== null) {
        return;
      }
      event.preventDefault();
      startXRef.current = event.clientX;
      startWidthRef.current = effectiveSidebarWidth;
      setIsResizing(true);
    },
    [effectiveSidebarWidth, widthOverride],
  );

  useEffect(() => {
    if (!isResizing) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const delta = event.clientX - startXRef.current;
      const nextWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, startWidthRef.current + delta),
      );
      setSidebarWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    const { style } = document.body;
    const previousCursor = style.cursor;
    const previousUserSelect = style.userSelect;
    style.cursor = 'col-resize';
    style.userSelect = 'none';

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      style.cursor = previousCursor;
      style.userSelect = previousUserSelect;
    };
  }, [isResizing]);

  useEffect(() => {
    if (pathname === '/chat') return;
    const container = contentRef.current;
    if (!container) return;

    // Defer until after layout to capture the latest content height.
    requestAnimationFrame(() => {
      if (!contentRef.current) return;
      contentRef.current.scrollTo({ top: 0, behavior: 'auto' });
    });
  }, [pathname]);

  return (
    <div
      className="flex h-screen overflow-hidden bg-slate-950 text-slate-100"
      style={layoutStyle}
    >
      <DashboardSidebar width={effectiveSidebarWidth}>
        <SidebarPortal />
      </DashboardSidebar>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(sidebarWidth)}
        aria-valuemin={MIN_SIDEBAR_WIDTH}
        aria-valuemax={MAX_SIDEBAR_WIDTH}
        onPointerDown={handlePointerDown}
        className={cn(
          'relative z-10 hidden h-screen w-1 cursor-col-resize md:flex md:items-center md:justify-center',
          isResizing
            ? 'bg-indigo-500/40'
            : 'bg-transparent hover:bg-slate-700/40',
        )}
      >
        <span className="pointer-events-none h-12 w-px rounded-full bg-slate-700" />
      </div>

      <div className="relative flex flex-1 flex-col">
        <div
          ref={contentRef}
          id="app-scroll-container"
          className="flex flex-1 flex-col overflow-y-auto"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
