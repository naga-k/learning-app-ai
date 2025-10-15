'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type SidebarContextValue = {
  content: ReactNode | null;
  setContent: (node: ReactNode | null) => void;
  widthOverride: number | null;
  setWidthOverride: (width: number | null) => void;
};

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

export function useSidebarState() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebarState must be used within a SidebarProvider');
  }
  return context;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null);
  const [widthOverride, setWidthOverride] = useState<number | null>(null);

  const value = useMemo<SidebarContextValue>(
    () => ({
      content,
      setContent,
      widthOverride,
      setWidthOverride,
    }),
    [content, widthOverride],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function SidebarPortal() {
  const context = useContext(SidebarContext);
  if (!context) {
    return null;
  }

  return context.content;
}

export function useSidebarContent(
  node?: ReactNode | null,
  options?: { width?: number | null },
) {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error('useSidebarContent must be used within a SidebarProvider');
  }

  const { setContent, setWidthOverride } = context;

  useEffect(() => {
    if (typeof node === 'undefined') {
      return;
    }

    setContent(node ?? null);
    setWidthOverride(
      typeof options?.width === 'number' ? options.width : options?.width ?? null,
    );

    return () => {
      setContent(null);
      setWidthOverride(null);
    };
  }, [node, options?.width, setContent, setWidthOverride]);
}
