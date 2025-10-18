"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, List, LogIn } from "lucide-react";
import type { CourseWithIds } from "@/lib/curriculum";
import type { CourseEngagementBlockSummary } from "@/lib/ai/tool-output";
import { CourseWorkspace } from "@/components/course/course-workspace";
import type { NavigationRailTopAction } from "@/components/course/navigation-rail";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useSupabase } from "@/components/supabase-provider";

type SharedCourseWorkspaceProps = {
  course: CourseWithIds;
  summary: string | null;
  courseMetadata: {
    courseId: string;
    courseVersionId: string;
    engagementBlocks?: CourseEngagementBlockSummary[] | null;
  };
  shareToken: string;
};

export function SharedCourseWorkspace({
  course,
  summary,
  courseMetadata,
  shareToken,
}: SharedCourseWorkspaceProps) {
  const router = useRouter();
  const { session } = useSupabase();
  const [mobileMenuExpanded, setMobileMenuExpanded] = useState(false);

  const courseTitle =
    course.overview?.title?.trim() ??
    course.overview?.focus?.trim() ??
    course.modules[0]?.title ??
    "Shared course";

  const nextUrl = useMemo(
    () => `/courses/${shareToken}`,
    [shareToken],
  );

  const handleOpenDashboard = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  const handleSignIn = useCallback(() => {
    router.push(`/login?next=${encodeURIComponent(nextUrl)}`);
  }, [nextUrl, router]);

  const ctaAction = session ? handleOpenDashboard : handleSignIn;
  const ctaLabel = session ? "Open dashboard" : "Sign in to learn";
  const CtaIcon = session ? LayoutDashboard : LogIn;

  const railTopAction: NavigationRailTopAction = useMemo(
    () => ({
      label: session ? "Dashboard" : "Sign in",
      icon: session ? LayoutDashboard : LogIn,
      onClick: ctaAction,
    }),
    [ctaAction, session],
  );

  const headerSlot = (
    <div className="sticky top-0 z-30 flex w-full items-center justify-between gap-3 border-b border-border bg-white/70 px-4 py-6 text-foreground shadow-sm backdrop-blur-xl transition-colors sm:px-6 dark:border-white/5 dark:bg-slate-950/80 dark:text-slate-100">
      <button
        type="button"
        onClick={() => setMobileMenuExpanded((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-100 dark:shadow-[0_0_30px_rgba(99,102,241,0.25)] dark:hover:border-white/20 dark:hover:bg-white/15 dark:focus-visible:ring-offset-slate-950 lg:hidden"
      >
        <List className="h-4 w-4" />
        Menu
      </button>

      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/80 dark:text-indigo-200">
          Course Architect
        </span>
        <span className="text-sm font-semibold text-foreground dark:text-slate-100">
          {courseTitle}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <button
          type="button"
          onClick={ctaAction}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-100 dark:shadow-[0_0_30px_rgba(99,102,241,0.25)] dark:hover:border-white/20 dark:hover:bg-white/15 dark:focus-visible:ring-offset-slate-950"
        >
          <CtaIcon className="h-4 w-4" />
          {ctaLabel}
        </button>
      </div>
    </div>
  );

  return (
    <CourseWorkspace
      course={course}
      summary={summary ?? undefined}
      headerSlot={headerSlot}
      mobileMenuExpanded={mobileMenuExpanded}
      setMobileMenuExpanded={setMobileMenuExpanded}
      courseMetadata={courseMetadata}
      readOnly
      shareToken={shareToken}
      allowAssistant
      railTopAction={railTopAction}
    />
  );
}
