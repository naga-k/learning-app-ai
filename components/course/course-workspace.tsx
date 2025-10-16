"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Flag,
  LayoutDashboard,
  List,
  LogOut as LogOutIcon,
  MessageCircle,
  Settings,
  X,
} from "lucide-react";
import { CourseWithIds } from "@/lib/curriculum";
import { cn, sanitizeUrl } from "@/lib/utils";
import { MarkdownContent, MarkdownInline } from "./markdown-content";
import { Linkify } from "./linkify";
import { CourseAssistantPanel } from "@/components/course/course-assistant-panel";
import { useSupabase } from "@/components/supabase-provider";
import {
  NavigationRail,
  type NavigationRailItem,
} from "@/components/course/navigation-rail";
import { ThemeToggle } from "@/components/theme/theme-toggle";

type CourseWorkspaceProps = {
  course: CourseWithIds;
  summary?: string;
  onBack: () => void;
  sidebarOffsetTop?: number;
  headerSlot?: ReactNode;
  mobileMenuExpanded?: boolean;
  setMobileMenuExpanded?: (expanded: boolean | ((prev: boolean) => boolean)) => void;
};

export function CourseWorkspace({
  course,
  summary,
  onBack,
  sidebarOffsetTop = 0,
  headerSlot,
  mobileMenuExpanded: externalMobileMenuExpanded,
  setMobileMenuExpanded: externalSetMobileMenuExpanded,
}: CourseWorkspaceProps) {
  const router = useRouter();
  const { supabase } = useSupabase();
  const lessonContentRef = useRef<HTMLDivElement | null>(null);
  const overviewContentRef = useRef<HTMLDivElement | null>(null);
  const conclusionContentRef = useRef<HTMLDivElement | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string>(
    course.modules[0]?.moduleId ?? "",
  );
  const [activeSubmoduleId, setActiveSubmoduleId] = useState<string>(
    course.modules[0]?.submodules[0]?.id ?? "",
  );
  const [viewMode, setViewMode] = useState<
    "overview" | "lesson" | "conclusion"
  >(() => {
    const summaryExists = Boolean(summary?.trim());
    const resourcesExist = (course.resources?.length ?? 0) > 0;
    const overviewDetailsExist =
      Boolean(course.overview?.title?.trim()) ||
      Boolean(course.overview?.description?.trim()) ||
      Boolean(course.overview?.focus?.trim()) ||
      Boolean(course.overview?.totalDuration?.trim());
    return summaryExists || resourcesExist || overviewDetailsExist
      ? "overview"
      : "lesson";
  });
  const [sidePanelView, setSidePanelView] = useState<
    "modules" | "assistant" | "settings"
  >("modules");
  const [internalMobileMenuExpanded, setInternalMobileMenuExpanded] = useState(false);
  const [mobileAccordionView, setMobileAccordionView] = useState<
    "modules" | "assistant"
  >("modules");
  const [sidebarWidth, setSidebarWidth] = useState(480); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);

  // Use external state if provided, otherwise use internal state
  const mobileAccordionExpanded = externalMobileMenuExpanded ?? internalMobileMenuExpanded;
  const setMobileAccordionExpanded = externalSetMobileMenuExpanded ?? setInternalMobileMenuExpanded;

  const handleActivateAssistant = useCallback(
    () => setSidePanelView("assistant"),
    [],
  );
  const handleNavigateDashboard = useCallback(() => {
    router.push("/dashboard");
  }, [router]);
  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
  }, [router, supabase]);

  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleTouchStart = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      // Constrain between min (288px = 18rem) and max (800px)
      if (newWidth >= 288 && newWidth <= 800) {
        setSidebarWidth(newWidth);
      }
    },
    [isResizing],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isResizing) return;
      const touch = e.touches[0];
      if (!touch) return;
      const newWidth = touch.clientX;
      // Constrain between min (288px = 18rem) and max (800px)
      if (newWidth >= 288 && newWidth <= 800) {
        setSidebarWidth(newWidth);
      }
    },
    [isResizing],
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
      return () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  useEffect(() => {
    const firstModule = course.modules[0];
    if (!firstModule) return;

    setActiveModuleId(firstModule.moduleId);
    setActiveSubmoduleId(firstModule.submodules[0]?.id ?? "");
    const summaryExists = Boolean(summary?.trim());
    const resourcesExist = (course.resources?.length ?? 0) > 0;
    setViewMode(summaryExists || resourcesExist ? "overview" : "lesson");
  }, [course, summary]);

  const hasCourseSummary = Boolean(summary?.trim());
  const hasResources = (course.resources?.length ?? 0) > 0;
  const overviewTitle =
    course.overview?.title?.trim() ??
    course.overview?.focus?.trim() ??
    "";
  const overviewDescription = course.overview?.description?.trim() ?? "";
  const hasOverviewDetails =
    Boolean(overviewTitle) ||
    Boolean(overviewDescription) ||
    Boolean(course.overview?.totalDuration?.trim());
  const hasOverviewContent =
    hasCourseSummary || hasResources || hasOverviewDetails;
  const conclusion = course.conclusion;
  const hasConclusion =
    Boolean(conclusion?.summary?.trim()) ||
    Boolean(conclusion?.celebrationMessage?.trim()) ||
    (conclusion?.recommendedNextSteps?.length ?? 0) > 0 ||
    (conclusion?.stretchIdeas?.length ?? 0) > 0;

  const activeModule = useMemo(
    () =>
      course.modules.find((module) => module.moduleId === activeModuleId) ??
      course.modules[0],
    [course.modules, activeModuleId],
  );

  const activeSubmodule = useMemo(() => {
    if (!activeModule) return undefined;
    return (
      activeModule.submodules.find(
        (submodule) => submodule.id === activeSubmoduleId,
      ) ?? activeModule.submodules[0]
    );
  }, [activeModule, activeSubmoduleId]);

  const moduleCount = course.modules.length;
  const totalLessons = course.modules.reduce(
    (sum, courseModule) => sum + courseModule.submodules.length,
    0,
  );
  const flattenedLessons = useMemo(
    () =>
      course.modules.flatMap((module) =>
        module.submodules.map((submodule) => ({
          moduleId: module.moduleId,
          submoduleId: submodule.id,
          moduleTitle: module.title,
          submoduleTitle: submodule.title,
          moduleOrder: module.order,
        })),
      ),
    [course.modules],
  );
  const firstLesson = flattenedLessons[0] ?? null;

  const currentLessonIndex = useMemo(() => {
    if (!activeModule || !activeSubmodule) return -1;
    return flattenedLessons.findIndex(
      (lesson) =>
        lesson.moduleId === activeModule.moduleId && lesson.submoduleId === activeSubmodule.id,
    );
  }, [activeModule, activeSubmodule, flattenedLessons]);

  const previousLesson = currentLessonIndex > 0 ? flattenedLessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex > -1 && currentLessonIndex < flattenedLessons.length - 1
      ? flattenedLessons[currentLessonIndex + 1]
      : null;

  const goToLesson = useCallback(
    (lesson: { moduleId: string; submoduleId: string }) => {
      setActiveModuleId(lesson.moduleId);
      setActiveSubmoduleId(lesson.submoduleId);
      setViewMode("lesson");
      requestAnimationFrame(() => {
        if (lessonContentRef.current) {
          lessonContentRef.current.scrollTop = 0;
        }
        document.getElementById("course-content-top")?.scrollIntoView({
          behavior: "instant",
          block: "start",
        });
      });
    },
    [lessonContentRef, setActiveModuleId, setActiveSubmoduleId, setViewMode],
  );

  const goToOverview = useCallback(() => {
    setViewMode("overview");
    requestAnimationFrame(() => {
      document.getElementById("course-content-top")?.scrollIntoView({
        behavior: "instant",
        block: "start",
      });
    });
  }, [setViewMode]);

  const goToWrapUp = useCallback(() => {
    setViewMode("conclusion");
    requestAnimationFrame(() => {
      document.getElementById("course-content-top")?.scrollIntoView({
        behavior: "instant",
        block: "start",
      });
    });
  }, [setViewMode]);

  const selectionSourceRef =
    viewMode === "overview"
      ? overviewContentRef
      : viewMode === "conclusion"
        ? conclusionContentRef
        : lessonContentRef;

  const navigationPrimaryItems = useMemo<NavigationRailItem[]>(
    () => [
      {
        key: "modules",
        label: "Modules",
        icon: List,
        onClick: () => setSidePanelView("modules"),
        active: sidePanelView === "modules",
      },
      {
        key: "assistant",
        label: "Assistant",
        icon: MessageCircle,
        onClick: () => setSidePanelView("assistant"),
        active: sidePanelView === "assistant",
      },
    ],
    [sidePanelView],
  );

  const navigationSecondaryItems = useMemo<NavigationRailItem[]>(
    () => [
      {
        key: "settings",
        label: "Settings",
        icon: Settings,
        onClick: undefined,
        disabled: true,
      },
      {
        key: "sign-out",
        label: "Sign out",
        icon: LogOutIcon,
        onClick: handleSignOut,
      },
    ],
    [handleSignOut],
  );

  const panelHeight = useMemo(
    () => `calc(100vh - ${sidebarOffsetTop}px)`,
    [sidebarOffsetTop],
  );

  const navigationContent = useMemo(() => {
    return (
      <div className="flex h-full w-full">
        <NavigationRail
          primaryItems={navigationPrimaryItems}
          secondaryItems={navigationSecondaryItems}
          onNavigateDashboard={handleNavigateDashboard}
          offsetTop={sidebarOffsetTop}
        />
        <div
          className={cn(
            "flex flex-1 flex-col overflow-hidden backdrop-blur-xl",
            sidePanelView === "assistant"
              ? "bg-slate-100 dark:bg-slate-950/60"
              : "bg-slate-50 dark:bg-white/[0.05]",
          )}
        >
          <div className="border-b border-slate-200 px-5 py-5 dark:border-white/10">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Course Architect
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">AI Learning Platform</p>
            </div>
            {sidePanelView === "modules" && (
              <div className="mt-5">
                <h2 className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600 dark:text-indigo-200">
                  Course Modules
                </h2>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  Navigate the journey from blueprint to mastery.
                </p>
              </div>
            )}
            {sidePanelView === "settings" && (
              <p className="mt-5 text-xs text-slate-600 dark:text-slate-400">
                Customize how this workspace looks and behaves. More options coming
                soon.
              </p>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {sidePanelView === "modules" && (
              <nav className="flex h-full min-h-0 flex-col overflow-y-auto px-3 py-4">
                {hasOverviewContent && (
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => setViewMode("overview")}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition",
                        viewMode === "overview"
                          ? "border-indigo-200 bg-indigo-100 text-indigo-900 shadow-sm dark:border-white/20 dark:bg-white/10 dark:text-slate-100 dark:shadow-[0_0_30px_rgba(129,140,248,0.35)]"
                          : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5",
                      )}
                    >
                      <BookOpen className="h-4 w-4 flex-shrink-0" />
                      Course overview
                    </button>
                  </div>
                )}

                {course.modules.map((module) => {
                  const moduleSelected = module.moduleId === activeModuleId;
                  const isActiveModule = viewMode === "lesson" && moduleSelected;

                  return (
                    <div key={module.moduleId} className="mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveModuleId(module.moduleId);
                          setActiveSubmoduleId(
                            module.submodules[0]?.id ?? activeSubmoduleId,
                          );
                          setViewMode("lesson");
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition",
                          isActiveModule
                            ? "border-indigo-200 bg-indigo-100 text-indigo-900 shadow-sm dark:border-indigo-400/30 dark:bg-indigo-500/20 dark:text-indigo-100 dark:shadow-[0_0_35px_rgba(79,70,229,0.35)]"
                            : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5",
                        )}
                      >
                        <div>
                          <p className="text-sm font-semibold">
                            Module {module.order}: {module.title}
                          </p>
                        </div>
                        {isActiveModule ? (
                          <ChevronDown className="h-4 w-4 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 flex-shrink-0" />
                        )}
                      </button>

                      {isActiveModule && (
                        <ul className="mt-3 space-y-1 border-l border-slate-200 pl-3 dark:border-white/10">
                          {module.submodules.map((submodule) => {
                            const submoduleActive =
                              submodule.id === activeSubmoduleId;
                            return (
                              <li key={submodule.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveSubmoduleId(submodule.id);
                                    setViewMode("lesson");
                                  }}
                                  className={cn(
                                    "w-full rounded-xl px-2 py-2 text-left text-sm transition",
                                    submoduleActive
                                      ? "bg-indigo-100 font-medium text-indigo-900 shadow-sm dark:bg-indigo-500/20 dark:text-indigo-100 dark:shadow-[0_0_25px_rgba(79,70,229,0.35)]"
                                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5",
                                  )}
                                >
                                  {submodule.order}. {submodule.title}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}

                {hasConclusion && (
                  <div className="mt-6 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setViewMode("conclusion")}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition",
                        viewMode === "conclusion"
                          ? "border-emerald-200 bg-emerald-100 text-emerald-900 shadow-sm dark:border-emerald-300/40 dark:bg-emerald-500/20 dark:text-emerald-100 dark:shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                          : "border-transparent text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 dark:text-emerald-200 dark:hover:border-emerald-200/30 dark:hover:bg-emerald-500/10",
                      )}
                    >
                      <Flag className="h-4 w-4 flex-shrink-0" />
                      Course wrap-up
                    </button>
                  </div>
                )}
              </nav>
            )}

            {activeModule && activeSubmodule && (
              <CourseAssistantPanel
                moduleTitle={activeModule.title}
                moduleSummary={activeModule.summary}
                lessonTitle={activeSubmodule.title}
                lessonSummary={activeSubmodule.summary}
                lessonContent={activeSubmodule.content}
                selectionSourceRef={selectionSourceRef}
                isActive={sidePanelView === "assistant"}
                onActivate={handleActivateAssistant}
                className="flex-1"
              />
            )}

            {sidePanelView === "settings" && (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground transition-colors dark:text-slate-300">
                <p className="text-sm font-semibold text-foreground dark:text-slate-100">
                  Workspace settings (coming soon)
                </p>
                <p className="text-xs text-muted-foreground dark:text-slate-400">
                  Configure notifications and personalization once options are available.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }, [
    activeModule,
    activeModuleId,
    activeSubmodule,
    activeSubmoduleId,
    course.modules,
    handleActivateAssistant,
    handleNavigateDashboard,
    hasConclusion,
    hasOverviewContent,
    navigationPrimaryItems,
    navigationSecondaryItems,
    selectionSourceRef,
    sidebarOffsetTop,
    sidePanelView,
    viewMode,
  ]);

  if (!activeModule || !activeSubmodule) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-muted px-8 text-center text-foreground transition-colors dark:bg-slate-950/40 dark:text-slate-100">
        <p className="text-lg font-medium text-foreground dark:text-slate-100">
          The generated course is missing lesson details.
        </p>
        <p className="max-w-md text-sm text-muted-foreground dark:text-slate-400">
          Please head back to the chat and request a fresh course.
        </p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:shadow-[0_0_30px_rgba(79,70,229,0.25)] dark:hover:border-white/20 dark:hover:bg-white/15 dark:focus-visible:ring-offset-slate-950"
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to chat
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-full overflow-x-hidden bg-background text-foreground transition-colors dark:text-slate-100"
      style={{ height: panelHeight }}
    >
      <aside
        className="hidden md:flex h-full shrink-0 flex-col border-r border-white/10 bg-slate-950/70 relative"
        style={{
          width: `${sidebarWidth}px`,
          minWidth: "18rem",
          maxWidth: "800px",
          height: panelHeight,
        }}
      >
        <div className="flex-1 overflow-hidden">
          {navigationContent}
        </div>
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize transition-colors group z-50 md:bg-muted md:hover:bg-accent/40 xl:bg-transparent xl:hover:bg-accent/50 dark:md:bg-indigo-500/30 dark:md:hover:bg-indigo-500/40 dark:xl:hover:bg-indigo-500/50"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          style={{
            backgroundColor: isResizing ? 'var(--color-ring)' : undefined,
          }}
        >
          <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 rounded-md border border-border bg-card px-1 py-2 text-foreground shadow-lg transition-[opacity,colors] md:opacity-100 xl:opacity-0 xl:group-hover:opacity-100 dark:border-white/20 dark:bg-slate-900/90 dark:text-slate-200">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground dark:text-slate-300">
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="5" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="15" cy="19" r="1" />
            </svg>
          </div>
        </div>
      </aside>

      <section
        className="flex flex-1 flex-col overflow-hidden bg-transparent"
        style={{ height: panelHeight }}
      >
        {headerSlot}

        {headerSlot ? (
          <>
            {mobileAccordionExpanded && (
              <div
                className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm transition-colors dark:bg-slate-950/60 lg:hidden"
                onClick={() => setMobileAccordionExpanded(false)}
              />
            )}
            <div className={cn(
              "fixed left-0 top-0 bottom-0 w-[min(85vw,400px)] z-50 border-r border-border bg-card/95 text-foreground backdrop-blur-xl transition-colors transform transition-transform duration-300 ease-out lg:hidden flex flex-col shadow-none dark:border-white/10 dark:bg-slate-950/95 dark:text-slate-100",
              mobileAccordionExpanded ? "translate-x-0" : "-translate-x-full"
            )}>
              <div className="flex items-center justify-between border-b border-border px-5 py-6 transition-colors dark:border-white/10">
                <h2 className="text-lg font-semibold text-foreground transition-colors dark:text-slate-100">
                  Course Menu
                </h2>
                <button
                  type="button"
                  onClick={() => setMobileAccordionExpanded(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted/70 text-foreground transition hover:bg-muted hover:text-foreground dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:border-white/20 dark:hover:bg-white/15"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close menu</span>
                </button>
              </div>

              <div className="border-b border-border px-5 py-4 transition-colors dark:border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setMobileAccordionExpanded(false);
                    handleNavigateDashboard();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-accent hover:text-accent-foreground dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:border-white/20 dark:hover:bg-white/15"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </button>
              </div>

              <div className="flex items-center gap-2 border-b border-border px-5 py-3 transition-colors dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setMobileAccordionView("modules")}
                  className={cn(
                    "flex-1 rounded-full border px-3 py-2 text-sm font-semibold transition",
                    mobileAccordionView === "modules"
                      ? "border-border bg-muted text-foreground dark:border-white/20 dark:bg-white/10 dark:text-slate-100"
                      : "border-transparent text-muted-foreground hover:bg-muted/60 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5",
                  )}
                >
                  Modules
                </button>
                <button
                  type="button"
                  onClick={() => setMobileAccordionView("assistant")}
                  className={cn(
                    "flex-1 rounded-full border px-3 py-2 text-sm font-semibold transition",
                    mobileAccordionView === "assistant"
                      ? "border-border bg-muted text-foreground dark:border-white/20 dark:bg-white/10 dark:text-slate-100"
                      : "border-transparent text-muted-foreground hover:bg-muted/60 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5",
                  )}
                >
                  Assistant
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4">
                {mobileAccordionView === "modules" ? (
                  <nav className="flex h-auto min-h-0 flex-col">
                    {hasOverviewContent && (
                      <div className="mb-4">
                        <button
                          type="button"
                          onClick={() => {
                            setViewMode("overview");
                            setMobileAccordionExpanded(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition",
                            viewMode === "overview"
                              ? "border-border bg-indigo-100/70 text-indigo-900 shadow-sm dark:border-white/20 dark:bg-white/10 dark:text-slate-100 dark:shadow-[0_0_30px_rgba(129,140,248,0.35)]"
                              : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5",
                          )}
                        >
                          <BookOpen className="h-4 w-4 flex-shrink-0" />
                          Course overview
                        </button>
                      </div>
                    )}

                    {course.modules.map((module) => {
                      const moduleSelected = module.moduleId === activeModuleId;
                      const isActiveModule = viewMode === "lesson" && moduleSelected;

                      return (
                        <div key={module.moduleId} className="mb-3">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveModuleId(module.moduleId);
                              setActiveSubmoduleId(
                                module.submodules[0]?.id ?? activeSubmoduleId,
                              );
                              setViewMode("lesson");
                              setMobileAccordionExpanded(false);
                            }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition",
                            isActiveModule
                              ? "border-indigo-200 bg-indigo-100 text-indigo-900 shadow-sm dark:border-indigo-400/30 dark:bg-indigo-500/20 dark:text-indigo-100 dark:shadow-[0_0_35px_rgba(79,70,229,0.35)]"
                              : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5",
                          )}
                        >
                          <div>
                            <p className="text-sm font-semibold">
                              Module {module.order}: {module.title}
                              </p>
                            </div>
                            {isActiveModule ? (
                              <ChevronDown className="h-4 w-4 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 flex-shrink-0" />
                            )}
                          </button>

                          {isActiveModule && (
                            <ul className="mt-3 space-y-1 border-l border-border pl-3 transition-colors dark:border-white/10">
                              {module.submodules.map((submodule) => {
                                const submoduleActive =
                                  submodule.id === activeSubmoduleId;
                                return (
                                  <li key={submodule.id}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveSubmoduleId(submodule.id);
                                        setViewMode("lesson");
                                        setMobileAccordionExpanded(false);
                                      }}
                                      className={cn(
                                        "w-full rounded-xl px-2 py-2 text-left text-sm transition",
                                        submoduleActive
                                          ? "bg-indigo-100/80 font-medium text-indigo-900 shadow-sm dark:bg-indigo-500/20 dark:text-indigo-100 dark:shadow-[0_0_25px_rgba(79,70,229,0.35)]"
                                          : "text-muted-foreground hover:bg-muted/40 dark:text-slate-400 dark:hover:bg-white/5",
                                      )}
                                    >
                                      {submodule.order}. {submodule.title}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      );
                    })}

                    {hasConclusion && (
                      <div className="mt-6 border-t border-border pt-4 transition-colors dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => {
                            setViewMode("conclusion");
                            setMobileAccordionExpanded(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition",
                            viewMode === "conclusion"
                              ? "border-emerald-200 bg-emerald-100 text-emerald-900 shadow-sm dark:border-emerald-300/40 dark:bg-emerald-500/20 dark:text-emerald-100 dark:shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                              : "border-transparent text-emerald-600 hover:border-emerald-200 hover:bg-emerald-100/70 dark:text-emerald-200 dark:hover:border-emerald-200/30 dark:hover:bg-emerald-500/10",
                          )}
                        >
                          <Flag className="h-4 w-4 flex-shrink-0" />
                          Course wrap-up
                        </button>
                      </div>
                    )}
                  </nav>
                ) : activeModule && activeSubmodule ? (
                  <CourseAssistantPanel
                    moduleTitle={activeModule.title}
                    moduleSummary={activeModule.summary}
                    lessonTitle={activeSubmodule.title}
                    lessonSummary={activeSubmodule.summary}
                    lessonContent={activeSubmodule.content}
                    selectionSourceRef={selectionSourceRef}
                    isActive={mobileAccordionExpanded && mobileAccordionView === "assistant"}
                    onActivate={handleActivateAssistant}
                    className="h-full"
                  />
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        <div
          ref={lessonContentRef}
          className="flex flex-1 min-h-0 flex-col overflow-y-auto"
        >
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-6 py-6 text-foreground transition-colors dark:border-white/10 dark:bg-transparent">
          <div className="space-y-3">
            {viewMode === "overview" && (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/80 dark:text-indigo-200">
                  Course Overview
                </p>
                <h1 className="text-2xl font-semibold text-foreground md:text-[2rem] dark:text-white">
                  {overviewTitle || "Your personalized learning path"}
                </h1>
                {overviewDescription && (
                  <p className="text-sm text-muted-foreground dark:text-slate-400">
                    <Linkify text={overviewDescription} />
                  </p>
                )}
                {course.overview?.totalDuration && (
                  <p className="text-sm text-muted-foreground dark:text-slate-400">
                    Estimated total time: {course.overview.totalDuration}
                  </p>
                )}
              </>
            )}

            {viewMode === "lesson" && (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/80 dark:text-indigo-200">
                  Module {activeModule.order}
                </p>
                <h1 className="text-2xl font-semibold text-foreground md:text-[2rem] dark:text-white">
                  {activeModule.title}
                </h1>
                {activeModule.summary && (
                  <p className="text-sm text-muted-foreground dark:text-slate-400">{activeModule.summary}</p>
                )}
              </>
            )}

            {viewMode === "conclusion" && (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-600 dark:text-emerald-200">
                  Course Wrap-up
                </p>
                <h1 className="text-2xl font-semibold text-foreground md:text-[2rem] dark:text-white">
                  Celebrate your progress
                </h1>
                <p className="text-sm text-muted-foreground dark:text-slate-400">
                  Reflect on what you’ve achieved and line up your next steps.
                </p>
              </>
            )}
          </div>
          {headerSlot ? null : (
            <div className="ml-auto flex flex-1 items-center gap-3">
              <button type="button" onClick={onBack} className="button-secondary">
                <ArrowLeft className="h-4 w-4" />
                Back to chat
              </button>
              <ThemeToggle className="ml-auto" />
            </div>
          )}
        </header>

          <div className="flex-1 px-6 py-4">
            {viewMode === "lesson" && (
              <div className="space-y-6">
                <div id="course-content-top" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {previousLesson ? (
                    <button
                      type="button"
                      onClick={() => goToLesson(previousLesson)}
                      className="button-secondary"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Previous module
                    </button>
                  ) : hasOverviewContent ? (
                    <button
                      type="button"
                      onClick={goToOverview}
                      className="button-secondary"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Course overview
                    </button>
                ) : (
                  <span />
                )}
                <span className="hidden sm:block" />
              </div>

              <div className="surface-panel px-6 py-8 text-foreground dark:text-slate-100 dark:shadow-[0_0_40px_-30px_rgba(15,23,42,0.6)]">
                <div className="mb-6 flex flex-col gap-3 border-b border-border pb-6 dark:border-white/10">
                  <h2 className="text-2xl font-semibold text-foreground dark:text-white">
                    {activeSubmodule.order}. {activeSubmodule.title}
                  </h2>
                  {activeSubmodule.duration && (
                    <p className="text-sm text-muted-foreground dark:text-slate-400">
                      ⏱ Suggested time: {activeSubmodule.duration}
                    </p>
                  )}
                  {activeSubmodule.summary && (
                    <p className="text-sm italic text-muted-foreground dark:text-slate-300">
                      {activeSubmodule.summary}
                    </p>
                  )}
                  </div>

                  <MarkdownContent content={activeSubmodule.content} />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  {nextLesson ? (
                    <button
                      type="button"
                      onClick={() => goToLesson(nextLesson)}
                      className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary shadow-sm transition hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10 dark:bg-indigo-500/20 dark:text-indigo-100 dark:hover:bg-indigo-500/30"
                    >
                      Next module
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={goToWrapUp}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-emerald-300/40 dark:bg-emerald-500/20 dark:text-emerald-100 dark:hover:bg-emerald-500/30"
                    >
                      Wrap up course
                      <Flag className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

          {viewMode === "overview" && (
            <div ref={overviewContentRef} className="space-y-8">
              <div id="course-content-top" />
              {firstLesson && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => goToLesson(firstLesson)}
                    className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary shadow-sm transition hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10 dark:bg-indigo-500/20 dark:text-indigo-100 dark:hover:bg-indigo-500/30"
                  >
                    Start learning
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
              {hasCourseSummary && (
                <div className="rounded-[26px] border border-slate-200 bg-white px-6 py-6 text-sm text-slate-900 shadow-md backdrop-blur dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-200 dark:shadow-[0_0_40px_-30px_rgba(15,23,42,0.6)]">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600 dark:text-indigo-200">
                    Course Introduction
                  </h3>
                  <p className="mt-3 whitespace-pre-line"><Linkify text={summary ?? ""} /></p>
                </div>
              )}

              {course.overview && (
                <div className="grid gap-4 md:grid-cols-2">
                  {overviewTitle && (
                    <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-5 text-sm text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:shadow-[0_0_25px_-20px_rgba(15,23,42,0.7)]">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700 dark:text-slate-300">
                        Course Title
                      </h3>
                      <p className="mt-3 whitespace-pre-line">
                        <Linkify text={overviewTitle} />
                      </p>
                    </div>
                  )}
                  {overviewDescription && (
                    <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-5 text-sm text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:shadow-[0_0_25px_-20px_rgba(15,23,42,0.7)]">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700 dark:text-slate-300">
                        Course Summary
                      </h3>
                      <p className="mt-3 whitespace-pre-line">
                        <Linkify text={overviewDescription} />
                      </p>
                    </div>
                  )}
                  {course.overview.totalDuration && (
                    <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-5 text-sm text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:shadow-[0_0_25px_-20px_rgba(15,23,42,0.7)]">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700 dark:text-slate-300">
                        Estimated Time
                      </h3>
                      <p className="mt-3">{course.overview.totalDuration}</p>
                    </div>
                  )}
                  {moduleCount > 0 && (
                    <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-5 text-sm text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:shadow-[0_0_25px_-20px_rgba(15,23,42,0.7)]">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700 dark:text-slate-300">
                        Modules
                      </h3>
                      <p className="mt-3">{moduleCount}</p>
                    </div>
                  )}
                  {totalLessons > 0 && (
                    <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-5 text-sm text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:shadow-[0_0_25px_-20px_rgba(15,23,42,0.7)]">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700 dark:text-slate-300">
                        Lessons
                      </h3>
                      <p className="mt-3">{totalLessons}</p>
                    </div>
                  )}
                </div>
              )}

              {hasResources && course.resources && (
                <div className="rounded-[26px] border border-slate-200 bg-white px-6 py-6 text-sm text-slate-900 shadow-md backdrop-blur dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:shadow-[0_0_30px_-25px_rgba(15,23,42,0.6)]">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700 dark:text-emerald-200">
                    Resources to explore
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {course.resources.map((resource, index) => (
                      <li
                        key={`resource-${index}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-emerald-900 dark:border-white/10 dark:bg-white/5 dark:text-emerald-50"
                      >
                        {resource.url ? (
                          <a
                            href={sanitizeUrl(resource.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 font-semibold text-emerald-900 hover:underline dark:text-white"
                          >
                            {resource.title}
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="font-semibold text-emerald-900 dark:text-white">{resource.title}</span>
                        )}

                        {resource.description && (
                          <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-100/80">— {resource.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {viewMode === "conclusion" && (
            <div ref={conclusionContentRef} className="space-y-8">
              <div id="course-content-top" />
              {conclusion?.summary && (
                <div className="rounded-[26px] border border-border bg-card px-6 py-6 text-sm text-foreground shadow-lg transition-colors dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:shadow-[0_0_30px_-25px_rgba(15,23,42,0.6)]">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700 dark:text-emerald-200">
                    Final Reflection
                  </h3>
                  <p className="mt-3 whitespace-pre-line">
                    <Linkify text={conclusion.summary ?? ""} />
                  </p>
                </div>
              )}

              {conclusion?.celebrationMessage && (
                <div className="rounded-[26px] border border-border bg-card px-6 py-6 text-sm text-foreground shadow-lg transition-colors dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:shadow-[0_0_30px_-25px_rgba(15,23,42,0.6)]">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/80 dark:text-indigo-200">
                    Celebrate the win
                  </h3>
                  <p className="mt-3 whitespace-pre-line">
                    <Linkify text={conclusion.celebrationMessage ?? ""} />
                  </p>
                </div>
              )}

              {conclusion?.recommendedNextSteps &&
                conclusion.recommendedNextSteps.length > 0 && (
                  <div className="rounded-[26px] border border-border bg-card px-6 py-6 text-sm text-foreground shadow-lg transition-colors dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:shadow-[0_0_30px_-25px_rgba(15,23,42,0.6)]">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/80 dark:text-indigo-200">
                      Recommended Next Steps
                    </h3>
                    <ul className="mt-4 space-y-2 list-disc pl-5 text-foreground dark:text-slate-100">
                      {conclusion.recommendedNextSteps.map((step, index) => (
                        <li key={`next-step-${index}`}>
                          <MarkdownInline content={step} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {conclusion?.stretchIdeas && conclusion.stretchIdeas.length > 0 && (
                <div className="rounded-[26px] border border-border bg-card px-6 py-6 text-sm text-foreground shadow-lg transition-colors dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:shadow-[0_0_30px_-25px_rgba(15,23,42,0.6)]">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/80 dark:text-indigo-200">
                    Stretch Ideas
                  </h3>
                  <ul className="mt-4 space-y-2 list-disc pl-5 text-foreground dark:text-slate-100">
                    {conclusion.stretchIdeas.map((idea, index) => (
                      <li key={`stretch-idea-${index}`}>
                        <MarkdownInline content={idea} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!hasConclusion && (
                <div className="rounded-[26px] border border-border bg-card px-6 py-6 text-sm text-muted-foreground shadow-lg transition-colors dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-200 dark:shadow-[0_0_30px_-25px_rgba(15,23,42,0.6)]">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground dark:text-slate-300">
                    Wrap-up coming soon
                  </h3>
                  <p className="mt-3 text-muted-foreground dark:text-slate-400">
                    This course doesn’t include a closing section yet. Review the
                    lessons above or request additional next steps in chat.
                  </p>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </section>
    </div>
  );
}
