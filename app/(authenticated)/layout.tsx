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
} from '@/components/dashboard/sidebar-provider';
import { cn } from '@/lib/utils';

const DEFAULT_SIDEBAR_WIDTH = 420;
const MIN_SIDEBAR_WIDTH = 208;
const MAX_SIDEBAR_WIDTH = 420;

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    pathname === '/dashboard' ? MIN_SIDEBAR_WIDTH : DEFAULT_SIDEBAR_WIDTH,
  );
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const previousNonDashboardWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);

  useEffect(() => {
    if (pathname === '/dashboard') {
      setSidebarWidth((current) => {
        if (current === MIN_SIDEBAR_WIDTH) {
          return current;
        }
        return MIN_SIDEBAR_WIDTH;
      });
      return;
    }

    const targetWidth = previousNonDashboardWidthRef.current ?? DEFAULT_SIDEBAR_WIDTH;
    setSidebarWidth((current) => {
      if (current === targetWidth) {
        return current;
      }
      return targetWidth;
    });
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/dashboard') {
      previousNonDashboardWidthRef.current = sidebarWidth;
    }
  }, [pathname, sidebarWidth]);

  const layoutStyle = useMemo(
    () =>
      ({
        '--sidebar-width': `${sidebarWidth}px`,
      }) as CSSProperties,
    [sidebarWidth],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      startXRef.current = event.clientX;
      startWidthRef.current = sidebarWidth;
      setIsResizing(true);
    },
    [sidebarWidth],
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
    <SidebarProvider>
      <div
        className="flex h-screen overflow-hidden bg-slate-950 text-slate-100"
        style={layoutStyle}
      >
        <DashboardSidebar width={sidebarWidth}>
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
    </SidebarProvider>
  );
}
