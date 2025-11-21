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
  Loader2,
} from "lucide-react";
import {
  CourseWithIds,
  type CourseEngagementBlockWithIds,
} from "@/lib/curriculum";
import { cn, sanitizeUrl } from "@/lib/utils";
import { MarkdownContent, MarkdownInline } from "./markdown-content";
import { Linkify } from "./linkify";
import { CourseAssistantPanel } from "@/components/course/course-assistant-panel";
import { useSupabase } from "@/components/supabase-provider";
import {
  NavigationRail,
  type NavigationRailItem,
  type NavigationRailTopAction,
} from "@/components/course/navigation-rail";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { CourseModuleProgress } from "@/lib/ai/tool-output";
import type { CourseEngagementBlockSummary } from "@/lib/ai/tool-output";
import type {
  EngagementBlock,
  QuizEngagementBlock,
  ReflectionEngagementBlock,
} from "@/lib/ai/tools/types";

type ModuleProgressEntry =
  NonNullable<CourseModuleProgress["modules"]>[number];
type ModuleProgressSubentry =
  ModuleProgressEntry["submodules"][number];

type CourseWorkspaceProps = {
  course: CourseWithIds;
  summary?: string;
  onBack?: () => void;
  sidebarOffsetTop?: number;
  headerSlot?: ReactNode;
  mobileMenuExpanded?: boolean;
  setMobileMenuExpanded?: (expanded: boolean | ((prev: boolean) => boolean)) => void;
  moduleProgress?: CourseModuleProgress | null;
  courseMetadata?: {
    courseId: string;
    courseVersionId: string;
    engagementBlocks?: CourseEngagementBlockSummary[] | null;
  } | null;
  readOnly?: boolean;
  shareToken?: string | null;
  allowAssistant?: boolean;
  railTopAction?: NavigationRailTopAction | null;
};

type QuizSavePayload = {
  kind: "quiz";
  selectedOptionIndex: number;
  isCorrect: boolean;
};

type ReflectionSavePayload = {
  kind: "reflection";
  text: string;
};

type EngagementSavePayload = QuizSavePayload | ReflectionSavePayload;

type EngagementResponseState = {
  blockId: string;
  blockType: "quiz" | "reflection";
  submoduleId: string;
  blockRevision: number;
  contentHash: string;
  response: unknown;
  isCorrect?: boolean | null;
  score?: number | null;
  stale?: boolean;
  saving?: boolean;
  error?: string | null;
  updatedAt?: string;
};

const isQuizBlock = (
  block: EngagementBlock,
): block is QuizEngagementBlock => block.type === "quiz";

const isReflectionBlock = (
  block: EngagementBlock,
): block is ReflectionEngagementBlock => block.type === "reflection";

function QuizEngagementBlockCard({
  block,
  index,
  response,
  onSave,
}: {
  block: QuizEngagementBlock & CourseEngagementBlockWithIds;
  index: number;
  response?: EngagementResponseState;
  onSave: (payload: { selectedOptionIndex: number; isCorrect: boolean }) => void;
}) {
  const responsePayload =
    response && response.response && typeof response.response === "object"
      ? (response.response as { selectedOptionIndex?: number })
      : null;
  const savedSelection =
    responsePayload && typeof responsePayload.selectedOptionIndex === "number"
      ? responsePayload.selectedOptionIndex
      : null;
  const savedIsCorrect =
    typeof response?.isCorrect === "boolean" ? response.isCorrect : null;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    savedSelection,
  );
  const [revealed, setRevealed] = useState(Boolean(savedIsCorrect !== null));

  useEffect(() => {
    setSelectedIndex(savedSelection);
    setRevealed(Boolean(savedIsCorrect !== null));
  }, [savedSelection, savedIsCorrect]);

  const handleCheckAnswer = () => {
    if (selectedIndex === null) return;
    setRevealed(true);
    const isCorrect = selectedIndex === block.correctOptionIndex;
    onSave({ selectedOptionIndex: selectedIndex, isCorrect });
  };

  const effectiveIsCorrect =
    revealed && selectedIndex !== null
      ? selectedIndex === block.correctOptionIndex
      : savedIsCorrect;
  const saving = Boolean(response?.saving);
  const errorMessage = response?.error;
  const isStale = Boolean(response?.stale);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[0_0_45px_-35px_rgba(148,163,184,0.55)]">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600 dark:text-indigo-200">
        <span className="inline-flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5" />
          Quiz {index + 1}
        </span>
        {block.difficulty && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold tracking-[0.2em] text-slate-500 dark:bg-white/10 dark:text-slate-300">
            {block.difficulty}
          </span>
        )}
      </div>

      <p className="mt-4 text-sm font-medium text-slate-900 dark:text-slate-100">
        {block.prompt}
      </p>

      <div className="mt-4 space-y-2">
        {block.options.map((option, optionIndex) => {
          const isSelected = selectedIndex === optionIndex;
          const isCorrect = optionIndex === block.correctOptionIndex;
          const highlightState = revealed
            ? isCorrect
              ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-400/50 dark:bg-emerald-500/20 dark:text-emerald-100"
              : isSelected
                ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-400/50 dark:bg-rose-500/20 dark:text-rose-100"
                : "border-slate-200 text-slate-700 dark:border-white/10 dark:text-slate-200"
            : isSelected
              ? "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-400/40 dark:bg-indigo-500/20 dark:text-indigo-100"
              : "border-slate-200 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/60 dark:border-white/10 dark:text-slate-200 dark:hover:border-indigo-300/40 dark:hover:bg-white/10";

          return (
            <button
              key={optionIndex}
              type="button"
              onClick={() => {
                setSelectedIndex(optionIndex);
                if (revealed) {
                  setRevealed(false);
                }
              }}
              className={cn(
                "w-full rounded-xl border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900",
                highlightState,
              )}
            >
              {option}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleCheckAnswer}
          disabled={selectedIndex === null || saving || isStale}
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
        >
          Check answer
        </button>

        <div className="text-xs text-slate-600 dark:text-slate-300">
          {isStale ? (
            <span className="text-rose-500 dark:text-rose-300">
              This activity changed. Refresh the course before answering.
            </span>
          ) : saving ? (
            "Saving…"
          ) : errorMessage ? (
            <span className="text-rose-500 dark:text-rose-300">{errorMessage}</span>
          ) : savedIsCorrect !== null ||
              (revealed && selectedIndex !== null) ? (
            "Saved"
          ) : null}
        </div>
      </div>

      {revealed && !isStale && (
        <div className="mt-4 text-xs text-slate-600 dark:text-slate-300">
          {effectiveIsCorrect
            ? "Nice! You picked the strongest option."
            : "Close! Take another look at the options above."}
          {block.rationale && (
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-300">
              {block.rationale}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ReflectionEngagementBlockCard({
  block,
  index,
  response,
  onSave,
  readOnly = false,
}: {
  block: ReflectionEngagementBlock & CourseEngagementBlockWithIds;
  index: number;
  response?: EngagementResponseState;
  onSave: (text: string) => void;
  readOnly?: boolean;
}) {
  const responsePayload =
    response && response.response && typeof response.response === "object"
      ? (response.response as { text?: string })
      : null;
  const savedText =
    responsePayload && typeof responsePayload.text === "string"
      ? responsePayload.text
      : "";
  const [notes, setNotes] = useState(savedText);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setNotes(savedText);
    }
  }, [dirty, savedText]);

  useEffect(() => {
    if (!dirty) return;
    if (notes === savedText) {
      setDirty(false);
      return;
    }
    const timeout = setTimeout(() => {
      onSave(notes);
      setDirty(false);
    }, 600);
    return () => clearTimeout(timeout);
  }, [dirty, notes, onSave, savedText]);

  const saving = Boolean(response?.saving);
  const errorMessage = response?.error;
  const isStale = Boolean(response?.stale);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 shadow-inner dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-300">
        <span className="inline-flex items-center gap-2">
          <MessageCircle className="h-3.5 w-3.5" />
          Reflection {index + 1}
        </span>
        {typeof block.expectedDurationMinutes === "number" && (
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 shadow-sm dark:bg-white/10 dark:text-slate-200">
            ⏱ {block.expectedDurationMinutes} min
          </span>
        )}
      </div>

      <p className="mt-4 text-sm font-medium text-slate-900 dark:text-slate-100">
        {block.prompt}
      </p>

      {block.guidance && (
        <p className="mt-3 rounded-xl bg-white px-4 py-3 text-xs italic text-slate-500 shadow-sm dark:bg-white/5 dark:text-slate-300">
          {block.guidance}
        </p>
      )}

      <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
        Your notes
        <textarea
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            setDirty(true);
          }}
          disabled={isStale}
          placeholder="Capture a quick reflection while the ideas are fresh…"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/30"
          rows={4}
        />
      </label>
      <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
        {readOnly ? (
          notes.trim().length > 0
            ? "Responses are stored locally for this page. Sign in to keep your notes."
            : "Sign in to save your reflections and track progress."
        ) : isStale ? (
          <span className="text-rose-500 dark:text-rose-300">
            This prompt changed. Refresh the course to continue.
          </span>
        ) : saving ? (
          "Saving…"
        ) : errorMessage ? (
          <span className="text-rose-500 dark:text-rose-300">{errorMessage}</span>
        ) : notes.trim().length > 0 ? (
          "Saved"
        ) : (
          "Changes save automatically."
        )}
      </div>
    </div>
  );
}

function LessonEngagementBlocks({
  blocks,
  submoduleId,
  responses,
  onSave,
  loading = false,
  persistenceReady,
  readOnly = false,
}: {
  blocks?: CourseEngagementBlockWithIds[];
  submoduleId: string;
  responses: Record<string, EngagementResponseState>;
  onSave: (
    block: CourseEngagementBlockWithIds,
    payload: EngagementSavePayload,
  ) => void;
  loading?: boolean;
  persistenceReady: boolean;
  readOnly?: boolean;
}) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="mt-10 space-y-5">
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-indigo-600 dark:text-indigo-200">
        <Loader2 className="h-3.5 w-3.5 animate-spin [animation-duration:2.2s]" />
        Active practice
      </div>

      {!persistenceReady ? (
        <p className="text-xs text-slate-500 dark:text-slate-300">
          {readOnly
            ? "Sign in to save your answers and track your progress."
            : "Engagement responses will sync once your course is finalized."}
        </p>
      ) : loading ? (
        <p className="text-xs text-slate-500 dark:text-slate-300">
          Restoring your saved answers…
        </p>
      ) : null}

      <div className="space-y-5">
        {blocks.map((block, index) =>
          isQuizBlock(block) ? (
            <QuizEngagementBlockCard
              block={block}
              index={index}
              key={`${submoduleId}-quiz-${index}`}
              response={responses[block.id]}
              onSave={(payload) =>
                onSave(block, {
                  kind: "quiz",
                  selectedOptionIndex: payload.selectedOptionIndex,
                  isCorrect: payload.isCorrect,
                })
              }
            />
          ) : isReflectionBlock(block) ? (
            <ReflectionEngagementBlockCard
              block={block}
              index={index}
              key={`${submoduleId}-reflection-${index}`}
              response={responses[block.id]}
              onSave={(text) =>
                onSave(block, {
                  kind: "reflection",
                  text,
                })
              }
              readOnly={readOnly}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}

export function CourseWorkspace({
  course,
  summary,
  onBack,
  sidebarOffsetTop = 0,
  headerSlot,
  mobileMenuExpanded: externalMobileMenuExpanded,
  setMobileMenuExpanded: externalSetMobileMenuExpanded,
  moduleProgress,
  courseMetadata = null,
  readOnly = false,
  shareToken = null,
  allowAssistant = true,
  railTopAction,
}: CourseWorkspaceProps) {
  const router = useRouter();
  const { supabase } = useSupabase();
  const lessonContentRef = useRef<HTMLDivElement | null>(null);
  const overviewContentRef = useRef<HTMLDivElement | null>(null);
  const conclusionContentRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedRef = useRef(false);
  const activeModuleIdRef = useRef<string>(course.modules[0]?.moduleId ?? "");
  const activeSubmoduleIdRef = useRef<string>(course.modules[0]?.submodules[0]?.id ?? "");
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
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(new Set());
  const [engagementResponses, setEngagementResponses] = useState<
    Record<string, EngagementResponseState>
  >({});
  const [engagementResponsesLoading, setEngagementResponsesLoading] = useState(false);
  const courseId = courseMetadata?.courseId ?? null;
  const courseVersionId = courseMetadata?.courseVersionId ?? null;
  const engagementPersistenceReady =
    !readOnly && Boolean(courseVersionId);
  const engagementLoading =
    engagementPersistenceReady && engagementResponsesLoading;

  // Helper function to toggle module expansion
  const toggleModuleExpanded = useCallback((moduleId: string) => {
    setExpandedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }, []);

  // Helper function to ensure module is expanded
  const ensureModuleExpanded = useCallback((moduleId: string) => {
    setExpandedModuleIds((prev) => {
      if (prev.has(moduleId)) return prev;
      return new Set([...prev, moduleId]);
    });
  }, []);

  // Use external state if provided, otherwise use internal state
  const mobileAccordionExpanded = externalMobileMenuExpanded ?? internalMobileMenuExpanded;
  const setMobileAccordionExpanded = externalSetMobileMenuExpanded ?? setInternalMobileMenuExpanded;

  useEffect(() => {
    let cancelled = false;

    if (readOnly) {
      setEngagementResponses({});
      setEngagementResponsesLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (!courseVersionId) {
      setEngagementResponses({});
      setEngagementResponsesLoading(false);
      return;
    }

    setEngagementResponsesLoading(true);

    const loadResponses = async () => {
      try {
        const response = await fetch(
          `/api/course-versions/${courseVersionId}/engagement-responses`,
        );
        if (!response.ok) {
          throw new Error(
            `Failed to load engagement responses (${response.status})`,
          );
        }
        const data = await response.json();
        if (cancelled) return;

        const mapped: Record<string, EngagementResponseState> = {};
        const items = Array.isArray(data?.responses) ? data.responses : [];
        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          const blockId = typeof item.blockId === "string" ? item.blockId : null;
          const blockType =
            item.blockType === "quiz" || item.blockType === "reflection"
              ? item.blockType
              : null;
          const submoduleId =
            typeof item.submoduleId === "string" ? item.submoduleId : null;
          const blockRevision =
            typeof item.blockRevision === "number" ? item.blockRevision : 1;
          const contentHash =
            typeof item.contentHash === "string" ? item.contentHash : "";
          if (!blockId || !blockType || !submoduleId || !contentHash) continue;

          mapped[blockId] = {
            blockId,
            blockType,
            submoduleId,
            blockRevision,
            contentHash,
            response: item.response ?? null,
            isCorrect:
              typeof item.isCorrect === "boolean" ? item.isCorrect : null,
            score: typeof item.score === "number" ? item.score : null,
            stale: Boolean(item.stale),
            saving: false,
            error: null,
            updatedAt:
              typeof item.updatedAt === "string" ? item.updatedAt : undefined,
          };
        }

        setEngagementResponses(mapped);
      } catch (error) {
        console.error("[course] failed to load engagement responses", error);
        if (!cancelled) {
          setEngagementResponses({});
        }
      } finally {
        if (!cancelled) {
          setEngagementResponsesLoading(false);
        }
      }
    };

    void loadResponses();

    return () => {
      cancelled = true;
    };
  }, [courseVersionId, readOnly]);

  const handleActivateAssistant = useCallback(() => {
    if (!allowAssistant) return;
    setSidePanelView("assistant");
  }, [allowAssistant]);

  useEffect(() => {
    if (!allowAssistant) {
      if (sidePanelView === "assistant") {
        setSidePanelView("modules");
      }
      if (mobileAccordionView === "assistant") {
        setMobileAccordionView("modules");
      }
    }
  }, [allowAssistant, mobileAccordionView, sidePanelView]);
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
    activeModuleIdRef.current = activeModuleId;
  }, [activeModuleId]);

  useEffect(() => {
    activeSubmoduleIdRef.current = activeSubmoduleId;
  }, [activeSubmoduleId]);

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

  const handleSaveEngagementResponse = useCallback(
    async (block: CourseEngagementBlockWithIds, payload: EngagementSavePayload) => {
      const baseState: EngagementResponseState = {
        blockId: block.id,
        blockType: block.type === "quiz" ? "quiz" : "reflection",
        submoduleId: block.submoduleId,
        blockRevision: block.revision,
        contentHash: block.contentHash,
        response:
          payload.kind === "quiz"
            ? { selectedOptionIndex: payload.selectedOptionIndex }
            : { text: payload.text },
        isCorrect: payload.kind === "quiz" ? payload.isCorrect : null,
        score: payload.kind === "quiz" ? (payload.isCorrect ? 1 : 0) : null,
        stale: false,
        saving: true,
        error: null,
      };

      if (readOnly) {
        if (payload.kind === "reflection" && payload.text.trim().length === 0) {
          setEngagementResponses((prev) => {
            const next = { ...prev };
            delete next[block.id];
            return next;
          });
          return;
        }

        setEngagementResponses((prev) => ({
          ...prev,
          [block.id]: {
            ...(prev[block.id] ?? { ...baseState, saving: false }),
            ...baseState,
            saving: false,
            updatedAt: new Date().toISOString(),
          },
        }));
        return;
      }

      if (!courseId || !courseVersionId) return;

      setEngagementResponses((prev) => ({
        ...prev,
        [block.id]: {
          ...(prev[block.id] ?? baseState),
          ...baseState,
        },
      }));

      try {
        if (payload.kind === "reflection" && payload.text.trim().length === 0) {
          const response = await fetch(
            `/api/course-versions/${courseVersionId}/engagement-responses/${encodeURIComponent(block.id)}`,
            { method: "DELETE" },
          );

          if (!response.ok) {
            throw new Error(
              `Failed to delete engagement response (${response.status})`,
            );
          }

          setEngagementResponses((prev) => {
            const next = { ...prev };
            delete next[block.id];
            return next;
          });
          return;
        }

        const response = await fetch(
          `/api/course-versions/${courseVersionId}/engagement-responses`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              blockId: block.id,
              blockType: block.type,
              submoduleId: block.submoduleId,
              contentHash: block.contentHash,
              response: baseState.response,
              score:
                typeof baseState.score === "number"
                  ? baseState.score
                  : undefined,
              isCorrect:
                typeof baseState.isCorrect === "boolean"
                  ? baseState.isCorrect
                  : undefined,
            }),
          },
        );

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);

          if (response.status === 409) {
            setEngagementResponses((prev) => ({
              ...prev,
              [block.id]: {
                ...(prev[block.id] ?? baseState),
                saving: false,
                stale: true,
                error:
                  typeof errorBody?.error === "string"
                    ? errorBody.error
                    : "This activity has updated. Refresh the course to continue.",
              },
            }));
            return;
          }

          throw new Error(
            typeof errorBody?.error === "string"
              ? errorBody.error
              : `Failed to save engagement response (${response.status})`,
          );
        }

        setEngagementResponses((prev) => ({
          ...prev,
          [block.id]: {
            ...(prev[block.id] ?? baseState),
            saving: false,
            stale: false,
            error: null,
            updatedAt: new Date().toISOString(),
          },
        }));
      } catch (error) {
        console.error("[course] failed to persist engagement response", error);
        setEngagementResponses((prev) => ({
          ...prev,
          [block.id]: {
            ...(prev[block.id] ?? baseState),
            saving: false,
            error:
              error instanceof Error ? error.message : String(error ?? "Unknown error"),
          },
        }));
      }
    },
    [courseId, courseVersionId, readOnly],
  );

  useEffect(() => {
    const firstModule = course.modules[0];
    if (!firstModule) return;

    const previousModuleId = activeModuleIdRef.current;
    const moduleExists = previousModuleId
      ? course.modules.some((module) => module.moduleId === previousModuleId)
      : false;
    const nextModuleId = moduleExists ? previousModuleId : firstModule.moduleId;

    if (nextModuleId !== activeModuleIdRef.current) {
      activeModuleIdRef.current = nextModuleId;
      setActiveModuleId(nextModuleId);
    }

    const moduleForSubmodule =
      course.modules.find((module) => module.moduleId === nextModuleId) ?? firstModule;

    const previousSubmoduleId = activeSubmoduleIdRef.current;
    const submoduleExists = previousSubmoduleId
      ? moduleForSubmodule.submodules.some((submodule) => submodule.id === previousSubmoduleId)
      : false;
    const nextSubmoduleId = submoduleExists
      ? previousSubmoduleId
      : moduleForSubmodule.submodules[0]?.id ?? "";

    if (nextSubmoduleId !== activeSubmoduleIdRef.current) {
      activeSubmoduleIdRef.current = nextSubmoduleId;
      setActiveSubmoduleId(nextSubmoduleId);
    }

    if (!hasInitializedRef.current) {
      const summaryExists = Boolean(summary?.trim());
      const resourcesExist = (course.resources?.length ?? 0) > 0;
      const overviewDetailsExist =
        Boolean(course.overview?.title?.trim()) ||
        Boolean(course.overview?.description?.trim()) ||
        Boolean(course.overview?.focus?.trim()) ||
        Boolean(course.overview?.totalDuration?.trim());

      setViewMode(summaryExists || resourcesExist || overviewDetailsExist ? "overview" : "lesson");
      hasInitializedRef.current = true;
    }
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
  const moduleProgressMap = useMemo(() => {
    if (!moduleProgress?.modules) {
      return new Map<
        string,
        {
          readyCount: number;
          totalCount: number;
          submoduleStatus: Map<string, boolean>;
        }
      >();
    }

    const map = new Map<
      string,
      {
        readyCount: number;
        totalCount: number;
        submoduleStatus: Map<string, boolean>;
      }
    >();

    moduleProgress.modules.forEach((entry: ModuleProgressEntry) => {
      const statusMap = new Map<string, boolean>();
      entry.submodules?.forEach((submodule: ModuleProgressSubentry) => {
        statusMap.set(submodule.id, Boolean(submodule.ready));
      });

      const readyCount =
        typeof entry.readyCount === "number"
          ? entry.readyCount
          : Array.from(statusMap.values()).filter(Boolean).length;
      const totalCount =
        typeof entry.totalCount === "number"
          ? entry.totalCount
          : statusMap.size;

      map.set(entry.moduleId, {
        readyCount,
        totalCount,
        submoduleStatus: statusMap,
      });
    });

    return map;
  }, [moduleProgress]);
  const readyLessonIds = useMemo(() => {
    const set = new Set<string>();
    moduleProgressMap.forEach((value) => {
      value.submoduleStatus.forEach((ready, submoduleId) => {
        if (ready) set.add(submoduleId);
      });
    });
    return set;
  }, [moduleProgressMap]);

  const allLessonsReady =
    (moduleProgress?.readySubmodules ?? totalLessons) >=
    (moduleProgress?.totalSubmodules ?? totalLessons);
  const activeLessonReady = useMemo(() => {
    if (!activeSubmoduleId) return true;
    if (readyLessonIds.size === 0) return true;
    return readyLessonIds.has(activeSubmoduleId);
  }, [activeSubmoduleId, readyLessonIds]);
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

  const navigationPrimaryItems = useMemo<NavigationRailItem[]>(() => {
    const items: NavigationRailItem[] = [
      {
        key: "modules",
        label: "Modules",
        icon: List,
        onClick: () => setSidePanelView("modules"),
        active: sidePanelView === "modules",
      },
    ];

    if (allowAssistant) {
      items.push({
        key: "assistant",
        label: "Assistant",
        icon: MessageCircle,
        onClick: () => setSidePanelView("assistant"),
        active: sidePanelView === "assistant",
      });
    }

    return items;
  }, [allowAssistant, sidePanelView]);

  const navigationSecondaryItems = useMemo<NavigationRailItem[]>(() => {
    if (readOnly) {
      return [];
    }

    return [
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
    ];
  }, [handleSignOut, readOnly]);

  const panelHeight = useMemo(
    () => `calc(100vh - ${sidebarOffsetTop}px)`,
    [sidebarOffsetTop],
  );

  const navigationContent = (
    <div className="flex h-full w-full">
        <NavigationRail
          primaryItems={navigationPrimaryItems}
          secondaryItems={navigationSecondaryItems}
          onNavigateDashboard={readOnly ? undefined : handleNavigateDashboard}
          topAction={railTopAction}
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

                {moduleProgress && !allLessonsReady && (
                  <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-sm animate-pulse dark:border-amber-300/40 dark:bg-amber-500/10 dark:text-amber-100">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      Generating lessons…{" "}
                      <span className="font-semibold">
                        {moduleProgress.readySubmodules ?? 0} of{" "}
                        {moduleProgress.totalSubmodules ?? totalLessons}
                      </span>{" "}
                      ready
                    </span>
                  </div>
                )}

                {course.modules.map((module) => {
                  const moduleSelected = module.moduleId === activeModuleId;
                  const isActiveModule = viewMode === "lesson" && moduleSelected;
                  const progressDetails = moduleProgressMap.get(module.moduleId);
                  const readyCount =
                    progressDetails?.readyCount ?? module.submodules.length;
                  const totalCount =
                    progressDetails?.totalCount ?? module.submodules.length;
                  const moduleReady = readyCount >= totalCount;
                  const moduleGenerating = !moduleReady;
                  const hasAnyReadySubmodule = readyCount > 0;
                  const moduleInteractive = hasAnyReadySubmodule || isActiveModule;

                  return (
                    <div key={module.moduleId} className="mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          const isExpanded = expandedModuleIds.has(module.moduleId);
                          if (isExpanded) {
                            // Collapse the module
                            toggleModuleExpanded(module.moduleId);
                          } else {
                            // Expand the module and navigate to first ready lesson
                            toggleModuleExpanded(module.moduleId);
                            setActiveModuleId(module.moduleId);
                            // Find the first ready submodule:
                            // - If no progress data exists (readyLessonIds.size === 0), all submodules are considered ready
                            // - Otherwise, find the first submodule that's marked as ready
                            const firstReadySubmodule = module.submodules.find(sub => 
                              readyLessonIds.size === 0 || readyLessonIds.has(sub.id)
                            );
                            setActiveSubmoduleId(
                              firstReadySubmodule?.id ?? module.submodules[0]?.id ?? activeSubmoduleId,
                            );
                            setViewMode("lesson");
                          }
                        }}
                        disabled={!moduleInteractive}
                        aria-disabled={!moduleInteractive}
                        className={cn(
                          "flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition",
                          isActiveModule
                            ? "border-indigo-200 bg-indigo-100 text-indigo-900 shadow-sm dark:border-indigo-400/30 dark:bg-indigo-500/20 dark:text-indigo-100 dark:shadow-[0_0_35px_rgba(79,70,229,0.35)]"
                            : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5",
                          moduleGenerating && "animate-pulse",
                          !moduleInteractive &&
                            "cursor-not-allowed border-dashed border-slate-300 bg-slate-100 text-slate-400 opacity-70 hover:border-slate-300 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-500 dark:hover:bg-white/[0.03]",
                        )}
                      >
                        <div className="flex flex-col">
                          <p className="text-sm font-semibold">
                            {module.title}
                          </p>
                          {moduleGenerating && (
                            <span className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-200">
                              {readyCount} of {totalCount} lessons ready
                            </span>
                          )}
                        </div>
                        {expandedModuleIds.has(module.moduleId) ? (
                          <ChevronDown className="h-4 w-4 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 flex-shrink-0" />
                        )}
                      </button>

                      {hasAnyReadySubmodule && expandedModuleIds.has(module.moduleId) && (
                        <ul className="mt-3 space-y-1 border-l border-slate-200 pl-3 dark:border-white/10">
                          {module.submodules.map((submodule) => {
                            const submoduleActive =
                              submodule.id === activeSubmoduleId;
                            const lessonReady =
                              readyLessonIds.size === 0
                                ? true
                                : readyLessonIds.has(submodule.id);
                            return (
                              <li key={submodule.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveModuleId(module.moduleId);
                                    setActiveSubmoduleId(submodule.id);
                                    setViewMode("lesson");
                                    // Ensure parent module is expanded
                                    ensureModuleExpanded(module.moduleId);
                                  }}
                                  className={cn(
                                    "w-full rounded-xl px-2 py-2 text-left text-sm transition",
                                    submoduleActive
                                      ? "bg-indigo-100 font-medium text-indigo-900 shadow-sm dark:bg-indigo-500/20 dark:text-indigo-100 dark:shadow-[0_0_25px_rgba(79,70,229,0.35)]"
                                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5",
                                    !lessonReady &&
                                      "animate-pulse cursor-wait text-slate-500 dark:text-slate-500",
                                  )}
                                  disabled={!lessonReady}
                                  aria-disabled={!lessonReady}
                                >
                                  <span className="flex items-center justify-between">
                                    <span>
                                      {submodule.order}. {submodule.title}
                                    </span>
                                    {!lessonReady && (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-200">
                                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                        Generating
                                      </span>
                                    )}
                                  </span>
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

            {allowAssistant && activeModule && activeSubmodule && (
              <CourseAssistantPanel
                moduleTitle={activeModule.title}
                moduleSummary={activeModule.summary}
                lessonTitle={activeSubmodule.title}
                lessonSummary={activeSubmodule.summary}
                lessonContent={activeLessonReady ? activeSubmodule.content : ""}
                lessonGenerating={!activeLessonReady}
                selectionSourceRef={selectionSourceRef}
                isActive={sidePanelView === "assistant"}
                onActivate={handleActivateAssistant}
                className="flex-1"
                shareToken={shareToken ?? undefined}
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

  if (!activeModule || !activeSubmodule) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-muted px-8 text-center text-foreground transition-colors dark:bg-slate-950/40 dark:text-slate-100">
        <p className="text-lg font-medium text-foreground dark:text-slate-100">
          The generated course is missing lesson details.
        </p>
        <p className="max-w-md text-sm text-muted-foreground dark:text-slate-400">
          Please head back to the chat and request a fresh course.
        </p>
        {onBack ? (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:shadow-[0_0_30px_rgba(79,70,229,0.25)] dark:hover:border-white/20 dark:hover:bg-white/15 dark:focus-visible:ring-offset-slate-950"
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to chat
          </button>
        ) : null}
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
                {allowAssistant ? (
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
                ) : null}
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
                              {module.title}
                            </p>
                          </div>
                            {isActiveModule ? (
                              <ChevronDown className="h-4 w-4 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 flex-shrink-0" />
                            )}
                          </button>

                          <ul className="mt-3 space-y-1 border-l border-border pl-3 transition-colors dark:border-white/10">
                              {module.submodules.map((submodule) => {
                                const submoduleActive =
                                  submodule.id === activeSubmoduleId;
                                return (
                                  <li key={submodule.id}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveModuleId(module.moduleId);
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
                ) : allowAssistant && activeModule && activeSubmodule ? (
                  <CourseAssistantPanel
                    moduleTitle={activeModule.title}
                    moduleSummary={activeModule.summary}
                    lessonTitle={activeSubmodule.title}
                    lessonSummary={activeSubmodule.summary}
                    lessonContent={activeLessonReady ? activeSubmodule.content : ""}
                    lessonGenerating={!activeLessonReady}
                    selectionSourceRef={selectionSourceRef}
                    isActive={mobileAccordionExpanded && mobileAccordionView === "assistant"}
                    onActivate={handleActivateAssistant}
                    className="h-full"
                    shareToken={shareToken ?? undefined}
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

                  {activeLessonReady ? (
                    <>
                      <MarkdownContent content={activeSubmodule.content} />
                      <LessonEngagementBlocks
                        blocks={activeSubmodule.engagementBlocks}
                        submoduleId={activeSubmodule.id}
                        responses={engagementResponses}
                        onSave={handleSaveEngagementResponse}
                        loading={engagementLoading}
                        persistenceReady={engagementPersistenceReady}
                        readOnly={readOnly}
                      />
                    </>
                  ) : (
                    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-100/60 p-8 text-center text-sm font-medium text-amber-800 animate-pulse dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <p>This lesson is still generating. Hang tight!</p>
                    </div>
                  )}
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

              {firstLesson && (
                <div className="flex justify-end pt-2">
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
