"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Loader2, MessageCircle, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

type CourseAssistantPanelProps = {
  moduleTitle: string;
  moduleSummary?: string | null;
  lessonTitle: string;
  lessonSummary?: string | null;
  lessonContent: string;
  selectionSourceRef: { current: HTMLElement | null };
};

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  selectionPreview?: string | null;
};

type SelectionPreview = {
  text: string;
  rect: DOMRect | null;
};

export function CourseAssistantPanel({
  moduleTitle,
  moduleSummary,
  lessonTitle,
  lessonSummary,
  lessonContent,
  selectionSourceRef,
}: CourseAssistantPanelProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedSelection, setCapturedSelection] = useState<string | null>(null);
  const [includeSelection, setIncludeSelection] = useState<boolean>(true);
  const [selectionPreview, setSelectionPreview] = useState<SelectionPreview | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const hasQuestion = question.trim().length > 0;
  const hasSelection = Boolean(capturedSelection && capturedSelection.trim().length > 0);

  useEffect(() => {
    const handleSelectionChange = () => {
      const container = selectionSourceRef.current;
      if (!container) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectionPreview(null);
        return;
      }

      const anchorNode = selection.anchorNode;
      const focusNode = selection.focusNode;

      const getElement = (node: Node | null): Element | null => {
        if (!node) return null;
        return node instanceof Element ? node : node.parentElement;
      };

      const anchorElement = getElement(anchorNode);
      const focusElement = getElement(focusNode);

      if (!anchorElement || !focusElement) {
        setSelectionPreview(null);
        return;
      }

      if (!container.contains(anchorElement) || !container.contains(focusElement)) {
        setSelectionPreview(null);
        return;
      }

      const text = selection.toString().trim();
      if (!text) {
        setSelectionPreview(null);
        return;
      }

      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const rect = range ? range.getBoundingClientRect() : null;

      setSelectionPreview({ text, rect });
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [selectionSourceRef]);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (scrollAnchorRef.current) {
      scrollAnchorRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, isSending]);

  const createMessageId = (role: ChatRole) =>
    `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const summarizeSelection = (text: string | null | undefined) => {
    if (!text) return null;
    const cleaned = text.trim().replace(/\s+/g, " ");
    if (!cleaned) return null;
    const snippet = cleaned.length > 120 ? cleaned.slice(0, 117) : cleaned;
    return `${snippet}${snippet.endsWith("...") ? "" : "..."}`;
  };

  const highlightButtonStyle = useMemo(() => {
    const rect = selectionPreview?.rect;
    const containerRect = selectionSourceRef.current?.getBoundingClientRect();
    if (!rect || !containerRect) return null;

    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), max);

    const centerX = clamp(
      rect.left + rect.width / 2,
      containerRect.left + rect.width / 2,
      containerRect.right - rect.width / 2,
    );
    const topOffset =
      rect.top - Math.min(40, rect.height > 80 ? rect.height / 2 : rect.height + 12);
    const top = clamp(topOffset, containerRect.top + 8, containerRect.bottom - 8);

    return {
      top,
      left: centerX,
      transform: "translate(-50%, 0)",
    } as CSSProperties;
  }, [selectionPreview, selectionSourceRef]);

  const captureCurrentSelection = () => {
    if (!selectionPreview) return;
    setCapturedSelection(selectionPreview.text);
    setIncludeSelection(true);
    setSelectionPreview(null);

    const activeSelection = window.getSelection();
    if (activeSelection) {
      activeSelection.removeAllRanges();
    }
  };

  const clearCapturedSelection = () => {
    setCapturedSelection(null);
    setIncludeSelection(true);
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (!hasQuestion && !hasSelection) return;

    const trimmedQuestion = question.trim();
    const shouldIncludeSelection = includeSelection && Boolean(capturedSelection);
    const selectionPreviewForMessage = shouldIncludeSelection
      ? summarizeSelection(capturedSelection)
      : null;
    const userContent =
      trimmedQuestion ||
      (capturedSelection ? `Could you explain this part?\n\n"${capturedSelection}"` : "");

    if (!userContent) return;

    const controller = new AbortController();
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = controller;

    setMessages((prev) => [
      ...prev,
      {
        id: createMessageId("user"),
        role: "user",
        content: userContent,
        selectionPreview: selectionPreviewForMessage,
      },
    ]);
    setIsSending(true);
    setError(null);
    setQuestion("");

    try {
      const response = await fetch("/api/course-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          question: trimmedQuestion || capturedSelection || "",
          moduleTitle,
          moduleSummary: moduleSummary ?? undefined,
          lessonTitle,
          lessonSummary: lessonSummary ?? undefined,
          lessonContent,
          selection: shouldIncludeSelection ? capturedSelection ?? undefined : undefined,
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        const message =
          (errorJson && typeof errorJson.error === "string"
            ? errorJson.error
            : "Something went wrong while contacting the assistant.");
        setError(message);
        return;
      }

      const data = (await response.json()) as { answer: string };
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId("assistant"),
          role: "assistant",
          content: data.answer.trim(),
        },
      ]);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("[CourseAssistantPanel] request failed", error);
      setError("Unable to reach the assistant. Please try again.");
    } finally {
      setIsSending(false);
      abortRef.current = null;
      setCapturedSelection(null);
      setIncludeSelection(true);
    }
  };

  const handleInputKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (isSending) return;
      formRef.current?.requestSubmit();
    }
  };

  return (
    <aside className="flex h-full min-h-[420px] flex-col rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-5 shadow-[0_0_35px_-25px_rgba(15,23,42,0.6)] backdrop-blur">
      <div className="mb-4 flex items-center gap-2 text-slate-200">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-200">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Course Assistant</p>
          <p className="text-xs text-slate-400">
            Ask questions about this lesson. Highlight text to capture it instantly.
          </p>
        </div>
      </div>

      {isMounted &&
        highlightButtonStyle &&
        createPortal(
          <button
            type="button"
            className="fixed z-[9999] rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold text-white shadow-lg transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            style={highlightButtonStyle}
            onMouseDown={(event) => event.preventDefault()}
            onClick={captureCurrentSelection}
          >
            Ask assistant
          </button>,
          document.body,
        )}

      <div className="flex-1 overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.02]">
        <div className="flex h-full flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm text-slate-100">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-slate-300">
                Ask for clarifications, summaries, or tips on this lesson. Highlight a passage
                and capture it to give the assistant more context.
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-full rounded-2xl px-4 py-3 shadow-sm",
                  message.role === "user"
                    ? "ml-auto bg-indigo-500/60 text-white"
                    : "mr-auto bg-white/[0.06] text-slate-100"
                )}
              >
                {message.role === "user" && message.selectionPreview && (
                  <p className="mb-1 text-[11px] font-medium text-indigo-100/80">
                    {`"${message.selectionPreview}"`}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
              </div>
            ))}

            {isSending && (
              <div className="mr-auto inline-flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3 text-xs text-slate-200">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            )}
            <div ref={scrollAnchorRef} />
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="border-t border-white/5 bg-white/[0.03] px-3 py-3">
            <div className="space-y-3">
              {capturedSelection && (
                <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-50">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-[2px] h-4 w-4 flex-shrink-0 text-indigo-200" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-indigo-200">
                          Highlight captured
                        </p>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-[10px] font-medium text-indigo-100">
                            <input
                              type="checkbox"
                              className="h-3 w-3 rounded border-indigo-300 bg-indigo-500/40 text-indigo-300 focus:ring-indigo-400"
                              checked={includeSelection}
                              onChange={(event) => setIncludeSelection(event.target.checked)}
                              disabled={isSending}
                            />
                            Include in context
                          </label>
                          <button
                            type="button"
                            className="flex items-center gap-1 rounded-full bg-indigo-500/20 px-2 py-[2px] text-[10px] font-semibold text-indigo-100 transition hover:bg-indigo-500/30 disabled:opacity-60"
                            onClick={clearCapturedSelection}
                            disabled={isSending}
                          >
                            <X className="h-3 w-3" />
                            Clear
                          </button>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap leading-snug text-indigo-100/90">
                        {capturedSelection}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Type your question..."
                className="min-h-[70px] w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
                onKeyDown={handleInputKeyDown}
                disabled={isSending}
              />

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isSending || (!hasQuestion && !hasSelection)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_25px_rgba(99,102,241,0.45)] transition hover:shadow-[0_0_35px_rgba(99,102,241,0.6)] focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950",
                    isSending && "opacity-70"
                  )}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-100">
          {error}
        </div>
      )}
    </aside>
  );
}
