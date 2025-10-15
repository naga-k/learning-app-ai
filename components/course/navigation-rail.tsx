"use client";

import { Brain, LayoutDashboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavigationRailItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
};

type NavigationRailProps = {
  primaryItems: NavigationRailItem[];
  secondaryItems: NavigationRailItem[];
  onNavigateDashboard: () => void;
  offsetTop?: number;
};

export function NavigationRail({
  primaryItems,
  secondaryItems,
  onNavigateDashboard,
  offsetTop = 0,
}: NavigationRailProps) {
  const stickyStyle = {
    top: offsetTop,
    height: `calc(100vh - ${offsetTop}px)`,
  } as const;

  return (
    <div
      className="sticky z-20 flex w-20 flex-col justify-between border-r border-white/10 bg-white/[0.04] py-6"
      style={stickyStyle}
    >
      <div className="flex flex-col items-center gap-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 shadow-[0_18px_35px_rgba(79,70,229,0.35)]">
          <Brain className="h-6 w-6 text-white" />
          <span className="sr-only">Course Architect</span>
        </div>
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={onNavigateDashboard}
            className="flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] font-medium text-slate-400 transition hover:text-slate-100"
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-[11px] tracking-tight">Dashboard</span>
          </button>
          {primaryItems.map(({ key, label, icon: Icon, active, onClick, disabled }) => {
            const formattedLabel =
              label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
            return (
              <button
                key={key}
                type="button"
                onClick={onClick}
                disabled={disabled}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] font-medium transition",
                  disabled
                    ? "cursor-not-allowed text-slate-500 opacity-40 hover:text-slate-500"
                    : active
                      ? "bg-white/15 text-white"
                      : "text-slate-400 hover:text-slate-100",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px] tracking-tight">{formattedLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col items-center gap-4">
        {secondaryItems.map(({ key, label, icon: Icon, onClick, disabled }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] font-medium transition hover:text-slate-100",
              disabled
                ? "cursor-not-allowed text-slate-500 opacity-40 hover:text-slate-500"
                : "text-slate-500",
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[11px] tracking-tight">
              {label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
