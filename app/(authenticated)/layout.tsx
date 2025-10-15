'use client';

import type { ReactNode } from 'react';

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <div
        id="app-scroll-container"
        className="flex flex-1 flex-col overflow-x-hidden"
      >
        {children}
      </div>
    </div>
  );
}
