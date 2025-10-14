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
};

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null);

  const value = useMemo<SidebarContextValue>(
    () => ({
      content,
      setContent,
    }),
    [content],
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

export function useSidebarContent(node?: ReactNode | null) {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error('useSidebarContent must be used within a SidebarProvider');
  }

  const { setContent } = context;

  useEffect(() => {
    if (typeof node === 'undefined') {
      return;
    }

    setContent(node ?? null);

    return () => {
      setContent(null);
    };
  }, [node, setContent]);
}
