"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Loader2, MessageCircle, Sparkles, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type CourseAssistantPanelProps = {
  moduleTitle: string;
  moduleSummary?: string | null;
  lessonTitle: string;
  lessonSummary?: string | null;
  lessonContent: string;
  lessonGenerating?: boolean;
  selectionSourceRef: { current: HTMLElement | null };
  isActive: boolean;
  onActivate: () => void;
  className?: string;
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
  lessonGenerating = false,
  selectionSourceRef,
  isActive,
  onActivate,
  className,
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const hasQuestion = question.trim().length > 0;
  const hasSelection = Boolean(capturedSelection && capturedSelection.trim().length > 0);

  const adjustTextareaHeight = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  };

  const handleClearConversation = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsSending(false);
    setMessages([]);
    setCapturedSelection(null);
    setSelectionPreview(null);
    setIncludeSelection(true);
    setError(null);
    setQuestion("");
    adjustTextareaHeight(textareaRef.current);
  };

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

  useEffect(() => {
    if (!isActive) return;
    if (textareaRef.current) {
      adjustTextareaHeight(textareaRef.current);
      textareaRef.current.focus({ preventScroll: true });
    }
  }, [isActive]);

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
    onActivate();

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
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const assistantMessageId = createMessageId("assistant");
    const updateAssistantMessage = (text: string) => {
      setMessages((prev) => {
        const index = prev.findIndex(
          (message) => message.id === assistantMessageId && message.role === "assistant",
        );
        if (index === -1) {
          return [
            ...prev,
            {
              id: assistantMessageId,
              role: "assistant",
              content: text,
            },
          ];
        }

        const next = [...prev];
        next[index] = { ...next[index], content: text };
        return next;
      });
    };

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
      if (!response.ok || !response.body) {
        const errorJson = await response.json().catch(() => null);
        const message =
          (errorJson && typeof errorJson.error === "string"
            ? errorJson.error
            : "Something went wrong while contacting the assistant.");
        setError(message);
        updateAssistantMessage("Sorry, I couldn't generate a response right now.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;

        fullAnswer += chunk;
        updateAssistantMessage(fullAnswer);
      }

      const flushText = decoder.decode();
      if (flushText) {
        fullAnswer += flushText;
      }

      updateAssistantMessage(fullAnswer.trim());
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("[CourseAssistantPanel] request failed", error);
      setError("Unable to reach the assistant. Please try again.");
      updateAssistantMessage("Sorry, I couldn't generate a response right now.");
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

  const hasAssistantReply = useMemo(
    () =>
      messages.some(
        (message) => message.role === "assistant" && message.content.trim().length > 0,
      ),
    [messages],
  );

  const canClearConversation = messages.length > 0 || hasQuestion || hasSelection || isSending;

  if (!isMounted) {
    return null;
  }

  const highlightButtonPortal =
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
    );

  const panelClasses = cn(
    "flex h-full flex-col border-l border-border bg-card text-foreground transition-colors dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100",
    !isActive && "hidden",
    className,
  );

  return (
    <>
      {highlightButtonPortal}
      <div className={panelClasses}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 transition-colors dark:border-white/10">
          <div className="flex items-center gap-3 text-muted-foreground dark:text-slate-200">
            <MessageCircle className="h-4 w-4 text-primary dark:text-indigo-200" />
            <div>
              <p className="text-sm font-semibold text-foreground dark:text-slate-100">Course Assistant</p>
              <p className="text-xs text-muted-foreground dark:text-slate-400">
                Ask questions about this lesson. Highlight text for instant context.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearConversation}
            disabled={!canClearConversation}
            className="inline-flex items-center justify-center rounded-full border border-border bg-muted p-2 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 dark:border-transparent dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-indigo-300 dark:focus-visible:ring-offset-slate-950"
            aria-label="Clear assistant conversation"
            title="Clear conversation"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5 text-sm text-foreground transition-colors dark:text-slate-100">
            {lessonGenerating && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800 animate-pulse dark:border-amber-300/40 dark:bg-amber-500/10 dark:text-amber-100">
                Lesson content is still generating. You&apos;ll see the full details once it&apos;s
                ready.
              </div>
            )}
            {messages.length === 0 && (
              <div className="rounded-2xl border border-border bg-muted px-4 py-4 text-muted-foreground transition-colors dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                Ask for clarifications, summaries, or tips on this lesson. Highlight a passage and
                capture it to give the assistant more context.
              </div>
            )}

            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div key={message.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm transition-colors",
                      isUser
                        ? "bg-primary text-primary-foreground dark:bg-indigo-500/60 dark:text-white"
                        : "bg-muted text-foreground dark:bg-white/[0.06] dark:text-slate-100",
                    )}
                  >
                    {isUser && message.selectionPreview && (
                      <p className="mb-1 text-[11px] font-medium text-primary-foreground/80 dark:text-indigo-100/80">
                        {`"${message.selectionPreview}"`}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
              );
            })}

            {isSending && !hasAssistantReply && (
              <div className="mr-auto inline-flex items-center gap-3 rounded-2xl bg-muted px-4 py-3 text-xs text-muted-foreground transition-colors dark:bg-white/[0.06] dark:text-slate-200">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            )}
            <div ref={scrollAnchorRef} />
          </div>

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="border-t border-border bg-transparent px-4 pb-5 pt-4 transition-colors sm:px-6 dark:border-white/10"
          >
            <div className="space-y-3">
              {capturedSelection && (
                <div className="mx-auto max-w-3xl rounded-2xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary transition-colors dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-50">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-[2px] h-4 w-4 flex-shrink-0 text-primary dark:text-indigo-200" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary dark:text-indigo-200">
                          Highlight captured
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full border border-transparent bg-primary/20 px-2 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500/30 dark:text-indigo-50 dark:hover:bg-indigo-500/40 dark:focus-visible:ring-indigo-300 dark:focus-visible:ring-offset-slate-950"
                            onClick={clearCapturedSelection}
                            disabled={isSending}
                          >
                            <X className="h-3 w-3" />
                            Clear
                          </button>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap leading-snug text-primary/80 dark:text-indigo-100/90">
                        {capturedSelection}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-[28px] border border-border bg-card p-2 shadow-lg transition-colors backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_20px_45px_rgba(15,23,42,0.55)]">
                <textarea
                  ref={textareaRef}
                  value={question}
                  onChange={(event) => {
                    setQuestion(event.target.value);
                    adjustTextareaHeight(event.target);
                  }}
                  onInput={(event) => {
                    adjustTextareaHeight(event.target as HTMLTextAreaElement);
                  }}
                  placeholder="Ask about this lesson or request a quick tip..."
                  className="max-h-40 min-h-[3rem] flex-1 resize-none rounded-[22px] border border-transparent bg-transparent px-5 py-3 text-sm text-foreground placeholder:text-muted-foreground transition focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-indigo-400/60 dark:focus:ring-indigo-500/30"
                  onKeyDown={handleInputKeyDown}
                  rows={1}
                  style={{
                    height: "auto",
                    overflowY: question.split("\n").length > 4 ? "auto" : "hidden",
                  }}
                />

                <button
                  type="submit"
                  aria-label="Send question to course assistant"
                  disabled={isSending || (!hasQuestion && !hasSelection)}
                  className={cn(
                    "inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.45)] transition hover:shadow-[0_0_45px_rgba(99,102,241,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-slate-950",
                  )}
                >
                  {isSending ? (
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {error && (
          <div className="border-t border-rose-500/40 bg-rose-500/10 px-5 py-3 text-xs text-rose-100">
            {error}
          </div>
        )}
      </div>
    </>
  );
}
