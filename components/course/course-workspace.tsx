"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ArrowLeft, BookOpen } from "lucide-react";
import { CourseWithIds } from "@/lib/curriculum";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "./markdown-content";

type CourseWorkspaceProps = {
  course: CourseWithIds;
  summary?: string;
  onBack: () => void;
};

export function CourseWorkspace({
  course,
  summary,
  onBack,
}: CourseWorkspaceProps) {
  const [activeModuleId, setActiveModuleId] = useState<string>(
    course.modules[0]?.moduleId ?? "",
  );
  const [activeSubmoduleId, setActiveSubmoduleId] = useState<string>(
    course.modules[0]?.submodules[0]?.id ?? "",
  );
  const [viewMode, setViewMode] = useState<"overview" | "lesson">(() => {
    const summaryExists = Boolean(summary?.trim());
    const resourcesExist = (course.resources?.length ?? 0) > 0;
    return summaryExists || resourcesExist ? "overview" : "lesson";
  });

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
  const hasOverviewContent = hasCourseSummary || hasResources;

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

  if (!activeModule || !activeSubmodule) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-white to-indigo-50 p-8 text-center dark:from-gray-900 dark:to-gray-800">
        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
          The generated course is missing lesson details.
        </p>
        <p className="max-w-md text-sm text-gray-600 dark:text-gray-400">
          Please head back to the chat and ask the assistant to regenerate the
          course.
        </p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to chat
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-80 flex-col border-r border-indigo-100 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/75">
        <div className="border-b border-indigo-100 px-4 py-5 dark:border-gray-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Course Modules
          </h2>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Click a module to explore its lessons.
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {hasOverviewContent && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setViewMode("overview")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors",
                  viewMode === "overview"
                    ? "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-500/60 dark:bg-indigo-500/10 dark:text-indigo-100"
                    : "border-transparent bg-transparent text-gray-700 hover:border-indigo-100 hover:bg-indigo-50/70 dark:text-gray-200 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10",
                )}
              >
                <BookOpen className="h-4 w-4 flex-shrink-0" />
                Course overview
              </button>
            </div>
          )}
          {course.modules.map((module) => {
            const isActive = module.moduleId === activeModuleId;
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
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                    isActive
                      ? "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-500/60 dark:bg-indigo-500/10 dark:text-indigo-100"
                      : "border-transparent bg-transparent text-gray-700 hover:border-indigo-100 hover:bg-indigo-50/70 dark:text-gray-200 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10",
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold">
                      Module {module.order}: {module.title}
                    </p>
                  </div>
                  {isActive ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                </button>

                {isActive && (
                  <ul className="mt-2 space-y-1 border-l border-indigo-200/60 pl-4 dark:border-indigo-500/40">
                    {module.submodules.map((submodule) => {
                      const submoduleActive = submodule.id === activeSubmoduleId;
                      return (
                        <li key={submodule.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSubmoduleId(submodule.id);
                              setViewMode("lesson");
                            }}
                            className={cn(
                              "w-full rounded-md px-2 py-2 text-left text-sm transition",
                              submoduleActive
                                ? "bg-indigo-100 font-medium text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-100"
                                : "text-gray-600 hover:bg-indigo-50 dark:text-gray-300 dark:hover:bg-indigo-500/10",
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
        </nav>
      </aside>

      <section className="flex flex-1 flex-col bg-gradient-to-br from-indigo-50 via-white to-indigo-100/30 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-950/30">
        <header className="flex items-center justify-between border-b border-indigo-100/80 px-8 py-6 backdrop-blur dark:border-gray-800/80">
          <div>
            {viewMode === "overview" ? (
              <>
                <p className="text-xs uppercase tracking-wide text-indigo-500 dark:text-indigo-300">
                  Course Overview
                </p>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {course.overview?.focus ?? "Your personalized learning path"}
                </h1>
                {course.overview?.totalDuration && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Estimated total time: {course.overview.totalDuration}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-xs uppercase tracking-wide text-indigo-500 dark:text-indigo-300">
                  Module {activeModule.order}
                </p>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {activeModule.title}
                </h1>
                {activeModule.summary && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {activeModule.summary}
                  </p>
                )}
              </>
            )}
          </div>

          <button
            onClick={onBack}
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-indigo-500/40 dark:bg-transparent dark:text-indigo-300 dark:hover:border-indigo-500/60 dark:hover:text-indigo-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to chat
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-8">
          {viewMode === "lesson" ? (
            <div className="rounded-2xl border border-white/60 bg-white/90 p-8 shadow-lg backdrop-blur dark:border-gray-800/80 dark:bg-gray-900/80">
              <div className="mb-6 flex flex-col gap-2 border-b border-gray-200 pb-6 dark:border-gray-700">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {activeSubmodule.order}. {activeSubmodule.title}
                </h2>
                {activeSubmodule.duration && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    ⏱️ Suggested time: {activeSubmodule.duration}
                  </p>
                )}
                {activeSubmodule.summary && (
                  <p className="text-sm italic text-gray-600 dark:text-gray-400">
                    {activeSubmodule.summary}
                  </p>
                )}
              </div>

              <MarkdownContent content={activeSubmodule.content} />
            </div>
          ) : (
            <div className="space-y-8">
              {hasCourseSummary && (
                <div className="rounded-2xl border border-indigo-200/70 bg-white/90 p-6 text-sm text-gray-700 shadow-sm backdrop-blur dark:border-gray-800/80 dark:bg-gray-900/80 dark:text-gray-300">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                    Course Summary
                  </h3>
                  <p className="mt-2 whitespace-pre-line">{summary}</p>
                </div>
              )}

              {hasResources && course.resources && (
                <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-6 shadow-sm backdrop-blur dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Further Resources
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm text-emerald-900 dark:text-emerald-100">
                    {course.resources.map((resource, index) => (
                      <li key={`resource-${index}`}>
                        <span className="font-medium">{resource.title}</span>
                        {resource.description && (
                          <span className="text-emerald-800/80 dark:text-emerald-200/80">
                            {" "}
                            — {resource.description}
                          </span>
                        )}
                        {resource.url && (
                          <span className="block text-xs text-emerald-700/70 dark:text-emerald-300/70">
                            {resource.url}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
