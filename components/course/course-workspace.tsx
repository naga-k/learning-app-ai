"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Flag,
} from "lucide-react";
import { CourseWithIds } from "@/lib/curriculum";
import { cn, sanitizeUrl } from "@/lib/utils";
import { MarkdownContent } from "./markdown-content";
import { Linkify } from "./linkify";

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
  const [viewMode, setViewMode] = useState<
    "overview" | "lesson" | "conclusion"
  >(() => {
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

  if (!activeModule || !activeSubmodule) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-950/40 px-8 text-center">
        <p className="text-lg font-medium text-slate-100">
          The generated course is missing lesson details.
        </p>
        <p className="max-w-md text-sm text-slate-400">
          Please head back to the chat and request a fresh course.
        </p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 shadow-[0_0_30px_rgba(79,70,229,0.25)] transition hover:border-white/20 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to chat
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden text-slate-100 md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-white/10 bg-white/[0.05] backdrop-blur-xl md:w-80 md:border-b-0 md:border-r">
        <div className="border-white/10 px-5 py-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-200">
            Course Modules
          </h2>
          <p className="mt-2 text-xs text-slate-400">
            Navigate the journey from blueprint to mastery.
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {hasOverviewContent && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setViewMode("overview")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition",
                  viewMode === "overview"
                    ? "border-white/20 bg-white/10 text-slate-100 shadow-[0_0_30px_rgba(129,140,248,0.35)]"
                    : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5",
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
                      ? "border-indigo-400/30 bg-indigo-500/20 text-indigo-100 shadow-[0_0_35px_rgba(79,70,229,0.35)]"
                      : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5",
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
                  <ul className="mt-3 space-y-1 border-l border-white/10 pl-3">
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
                              "w-full rounded-xl px-2 py-2 text-left text-sm transition",
                              submoduleActive
                                ? "bg-indigo-500/20 font-medium text-indigo-100 shadow-[0_0_25px_rgba(79,70,229,0.35)]"
                                : "text-slate-400 hover:bg-white/5",
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
            <div className="mt-6 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setViewMode("conclusion")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition",
                  viewMode === "conclusion"
                    ? "border-emerald-300/40 bg-emerald-500/20 text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                    : "border-transparent text-emerald-200 hover:border-emerald-200/30 hover:bg-emerald-500/10",
                )}
              >
                <Flag className="h-4 w-4 flex-shrink-0" />
                Course wrap-up
              </button>
            </div>
          )}
        </nav>
      </aside>

      <section className="flex flex-1 flex-col overflow-hidden bg-transparent">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-6">
          <div className="space-y-3">
            {viewMode === "overview" && (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-200">
                  Course Overview
                </p>
                <h1 className="text-2xl font-semibold text-white md:text-[2rem]">
                  {course.overview?.focus ?? "Your personalized learning path"}
                </h1>
                {course.overview?.totalDuration && (
                  <p className="text-sm text-slate-400">
                    Estimated total time: {course.overview.totalDuration}
                  </p>
                )}
              </>
            )}

            {viewMode === "lesson" && (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-200">
                  Module {activeModule.order}
                </p>
                <h1 className="text-2xl font-semibold text-white md:text-[2rem]">
                  {activeModule.title}
                </h1>
                {activeModule.summary && (
                  <p className="text-sm text-slate-400">{activeModule.summary}</p>
                )}
              </>
            )}

            {viewMode === "conclusion" && (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">
                  Course Wrap-up
                </p>
                <h1 className="text-2xl font-semibold text-white md:text-[2rem]">
                  Celebrate your progress
                </h1>
                <p className="text-sm text-slate-400">
                  Reflect on what you’ve achieved and line up your next steps.
                </p>
              </>
            )}
          </div>

        </header>

        <div className="flex-1 overflow-y-auto px-6 py-8">
          {viewMode === "lesson" && (
            <div className="rounded-[26px] border border-white/10 bg-white/[0.02] px-6 py-8 shadow-[0_0_40px_-30px_rgba(15,23,42,0.6)] backdrop-blur">
              <div className="mb-6 flex flex-col gap-3 border-b border-white/10 pb-6">
                <h2 className="text-2xl font-semibold text-white">
                  {activeSubmodule.order}. {activeSubmodule.title}
                </h2>
                {activeSubmodule.duration && (
                  <p className="text-sm text-slate-400">
                    ⏱ Suggested time: {activeSubmodule.duration}
                  </p>
                )}
                {activeSubmodule.summary && (
                  <p className="text-sm italic text-slate-300">
                    {activeSubmodule.summary}
                  </p>
                )}
              </div>

              <MarkdownContent content={activeSubmodule.content} />
            </div>
          )}

          {viewMode === "overview" && (
            <div className="space-y-8">
              {hasCourseSummary && (
                <div className="rounded-[26px] border border-white/10 bg-white/[0.02] px-6 py-6 text-sm text-slate-200 shadow-[0_0_40px_-30px_rgba(15,23,42,0.6)] backdrop-blur">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-200">
                    Course Introduction
                  </h3>
                  <p className="mt-3 whitespace-pre-line"><Linkify text={summary ?? ""} /></p>
                </div>
              )}

              {course.overview && (
                <div className="grid gap-4 md:grid-cols-2">
                  {course.overview.focus && (
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-5 py-5 text-sm text-slate-100 shadow-[0_0_25px_-20px_rgba(15,23,42,0.7)]">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.3em]">
                        Primary Focus
                      </h3>
                      <p className="mt-3 whitespace-pre-line">
                        <Linkify text={course.overview.focus ?? ""} />
                      </p>
                    </div>
                  )}
                  {course.overview.totalDuration && (
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-5 py-5 text-sm text-slate-100 shadow-[0_0_25px_-20px_rgba(15,23,42,0.7)]">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.3em]">
                        Estimated Time
                      </h3>
                      <p className="mt-3">{course.overview.totalDuration}</p>
                    </div>
                  )}
                  {moduleCount > 0 && (
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-5 py-5 text-sm text-slate-100 shadow-[0_0_25px_-20px_rgba(15,23,42,0.7)]">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.3em]">
                        Modules
                      </h3>
                      <p className="mt-3">{moduleCount}</p>
                    </div>
                  )}
                  {totalLessons > 0 && (
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-5 py-5 text-sm text-slate-100 shadow-[0_0_25px_-20px_rgba(15,23,42,0.7)]">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.3em]">
                        Lessons
                      </h3>
                      <p className="mt-3">{totalLessons}</p>
                    </div>
                  )}
                </div>
              )}

              {hasResources && course.resources && (
                <div className="rounded-[26px] border border-white/10 bg-white/[0.04] px-6 py-6 text-sm text-slate-100 shadow-[0_0_30px_-25px_rgba(15,23,42,0.6)] backdrop-blur">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">
                    Resources to explore
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {course.resources.map((resource, index) => (
                      <li
                        key={`resource-${index}`}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-emerald-50"
                      >
                        {resource.url ? (
                          <a
                            href={sanitizeUrl(resource.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-white hover:underline"
                          >
                            {resource.title}
                          </a>
                        ) : (
                          <span className="font-semibold text-white">{resource.title}</span>
                        )}

                        {resource.description && (
                          <p className="mt-1 text-emerald-100/80 text-sm">— {resource.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {viewMode === "conclusion" && (
            <div className="space-y-8">
              {conclusion?.summary && (
                <div className="rounded-[26px] border border-white/10 bg-white/[0.04] px-6 py-6 text-sm text-slate-100 shadow-[0_0_30px_-25px_rgba(15,23,42,0.6)] backdrop-blur">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">
                    Final Reflection
                  </h3>
                  <p className="mt-3 whitespace-pre-line">
                    <Linkify text={conclusion.summary ?? ""} />
                  </p>
                </div>
              )}

              {conclusion?.celebrationMessage && (
                <div className="rounded-[26px] border border-white/10 bg-white/[0.04] px-6 py-6 text-sm text-slate-100 shadow-[0_0_30px_-25px_rgba(15,23,42,0.6)] backdrop-blur">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-200">
                    Celebrate the win
                  </h3>
                  <p className="mt-3 whitespace-pre-line">
                    <Linkify text={conclusion.celebrationMessage ?? ""} />
                  </p>
                </div>
              )}

              {conclusion?.recommendedNextSteps &&
                conclusion.recommendedNextSteps.length > 0 && (
                  <div className="rounded-[26px] border border-white/10 bg-white/[0.04] px-6 py-6 text-sm text-slate-100 shadow-[0_0_30px_-25px_rgba(15,23,42,0.6)] backdrop-blur">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-200">
                      Recommended Next Steps
                    </h3>
                    <ul className="mt-4 space-y-2 list-disc pl-5 text-slate-100">
                      {conclusion.recommendedNextSteps.map((step, index) => (
                        <li key={`next-step-${index}`}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {conclusion?.stretchIdeas && conclusion.stretchIdeas.length > 0 && (
                <div className="rounded-[26px] border border-white/10 bg-white/[0.04] px-6 py-6 text-sm text-slate-100 shadow-[0_0_30px_-25px_rgba(15,23,42,0.6)] backdrop-blur">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-200">
                    Stretch Ideas
                  </h3>
                  <ul className="mt-4 space-y-2 list-disc pl-5 text-slate-100">
                    {conclusion.stretchIdeas.map((idea, index) => (
                      <li key={`stretch-idea-${index}`}>{idea}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!hasConclusion && (
                <div className="rounded-[26px] border border-white/10 bg-white/[0.02] px-6 py-6 text-sm text-slate-200 shadow-[0_0_30px_-25px_rgba(15,23,42,0.6)] backdrop-blur">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">
                    Wrap-up coming soon
                  </h3>
                  <p className="mt-3 text-slate-400">
                    This course doesn’t include a closing section yet. Review the
                    lessons above or request additional next steps in chat.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
