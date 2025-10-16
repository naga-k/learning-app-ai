"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { UseChatHelpers } from "@ai-sdk/react";
import {
  getToolOrDynamicToolName,
  isToolOrDynamicToolUIPart,
  type UIMessage,
} from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import {
  hasRenderableAssistantContent,
  isCourseToolOutput,
  isPlanToolOutput,
  isToolErrorOutput,
  type PlanToolOutput,
} from "@/lib/ai/tool-output";
import { cn } from "@/lib/utils";

type ChatPanelProps = {
  messages: UIMessage[];
  status: UseChatHelpers<UIMessage>["status"];
  onSendMessage: (text: string) => void;
  isLocked?: boolean;
};

export function ChatPanel({
  messages,
  status,
  onSendMessage,
  isLocked = false,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const toolStartTimesRef = useRef<
    Map<string, { localStart: number; serverStart?: number }>
  >(new Map());
  const toolTimerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, forceToolTimerTick] = useState(0);
  const formatDuration = (ms?: number) => {
    if (!ms || ms <= 0) return null;
    const seconds = ms / 1000;
    if (seconds < 10) {
      return `${seconds.toFixed(1)}s`;
    }
    return `${Math.round(seconds)}s`;
  };

  const extractToolPayload = (
    part: Parameters<typeof isToolOrDynamicToolUIPart>[0],
  ): unknown =>
    (part as { output?: unknown }).output ??
    (part as { result?: unknown }).result ??
    null;

  const isPreliminaryPart = (
    part: Parameters<typeof isToolOrDynamicToolUIPart>[0],
  ): boolean => Boolean((part as { preliminary?: boolean }).preliminary);

  const renderableMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          message.role !== "assistant" || hasRenderableAssistantContent(message),
      ),
    [messages],
  );

  const lastAssistantMessage = useMemo(
    () =>
      [...messages].reverse().find((msg) => msg.role === "assistant") ?? null,
    [messages],
  );

  const shouldShowTypingIndicator =
    status === "streaming" && !hasRenderableAssistantContent(lastAssistantMessage);

  const hasActiveToolStream = useMemo(
    () =>
      messages.some((message) =>
        Array.isArray(message.parts) &&
        message.parts.some((part) => {
          if (!isToolOrDynamicToolUIPart(part)) return false;
          return (
            part.state === "input-streaming" ||
            part.state === "input-available" ||
            (part.state === "output-available" && isPreliminaryPart(part))
          );
        }),
      ),
    [messages],
  );

  useEffect(() => {
    if (hasActiveToolStream) {
      if (!toolTimerIntervalRef.current) {
        toolTimerIntervalRef.current = setInterval(() => {
          forceToolTimerTick((tick) => tick + 1);
        }, 200);
      }
    } else {
      if (toolTimerIntervalRef.current) {
        clearInterval(toolTimerIntervalRef.current);
        toolTimerIntervalRef.current = null;
      }
      toolStartTimesRef.current.clear();
    }

    return () => {
      if (toolTimerIntervalRef.current) {
        clearInterval(toolTimerIntervalRef.current);
        toolTimerIntervalRef.current = null;
      }
    };
  }, [hasActiveToolStream]);

  const resetTextareaHeight = (target: HTMLTextAreaElement) => {
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (!input.trim() || isLocked) return;
    onSendMessage(input);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (
    event,
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (isLocked) return;
      if (input.trim() && status !== "streaming") {
        handleSubmit(event as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  useEffect(() => {
    if (!isLocked) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [isLocked]);

  return (
    <div className="relative flex min-h-[60vh] flex-1 flex-col overflow-hidden rounded-[26px] border border-border bg-card transition-colors dark:border-white/8 dark:bg-white/[0.04]">
      <div className="relative flex-1 overflow-hidden">
        <Conversation className="flex h-full flex-col">
          <ConversationContent className="flex flex-1 flex-col gap-2.5 px-6 py-8 sm:px-10">
            {messages.length === 0 ? (
              <ConversationEmptyState className="space-y-2 rounded-3xl border border-border bg-muted px-8 py-12 text-left text-muted-foreground shadow-xl transition-colors backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:shadow-[0_0_45px_rgba(15,23,42,0.75)]">
                <h3 className="text-lg font-semibold text-foreground dark:text-white">
                  Learn something new?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Drop a goal, topic, or skill and we’ll map the path to get you there.
                </p>
              </ConversationEmptyState>
            ) : (
              <>
                {renderableMessages.map((message, messageIndex) => {
                  const isUser = message.role === "user";
                  let planToolPayload: PlanToolOutput | null = null;

                  const partNodes = (Array.isArray(message.parts) ? message.parts : []).map(
                    (part, index) => {
                      const partKey = `${message.id}-${index}`;

                      if (part.type === "text") {
                        return (
                          <Response
                            key={`${message.id}-${index}`}
                            className={cn(
                              "w-full max-w-none transition-colors prose prose-sm",
                              isUser
                                ? "text-white prose-invert [&_p]:text-white"
                                : "text-slate-900 [&_p]:text-slate-900 dark:prose-invert dark:text-slate-100 dark:[&_p]:text-slate-100"
                            )}
                          >
                            {part.text}
                          </Response>
                        );
                      }

                      if (isToolOrDynamicToolUIPart(part)) {
                        const toolName = getToolOrDynamicToolName(part);
                        const isCourseTool = toolName === "generate_course";
                        const isPlanTool = toolName === "generate_plan";
                        const streamingMessage = isCourseTool
                          ? "Synthesizing your immersive course..."
                          : isPlanTool
                            ? "Designing your learning blueprint..."
                            : "Working on your request...";
                        const isStreamingState =
                          part.state === "input-streaming" ||
                          part.state === "input-available" ||
                          (part.state === "output-available" && isPreliminaryPart(part));

                        if (isStreamingState) {
                          const startInfo = toolStartTimesRef.current.get(partKey);
                          if (!startInfo) {
                            toolStartTimesRef.current.set(partKey, {
                              localStart: Date.now(),
                            });
                          }
                          const activeInfo = toolStartTimesRef.current.get(partKey)!;
                          const baseStart =
                            typeof activeInfo.serverStart === "number"
                              ? activeInfo.serverStart
                              : activeInfo.localStart;
                          const elapsedLabel = formatDuration(Date.now() - baseStart);
                          return (
                            <div
                              key={`${message.id}-${index}`}
                              aria-live="polite"
                              className="mt-2 flex items-center gap-2 text-sm text-muted-foreground transition-colors dark:text-slate-300"
                            >
                              <Loader size={16} />
                              <span className="animate-pulse">{streamingMessage}</span>
                              {elapsedLabel && (
                                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-slate-500">
                                  {elapsedLabel}
                                </span>
                              )}
                            </div>
                          );
                        }

                        if (part.state === "output-error") {
                          return (
                            <div
                              key={`${message.id}-${index}`}
                              className="mt-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 transition-colors dark:text-rose-100"
                            >
                              {part.errorText ?? "Something went wrong while running the tool."}
                            </div>
                          );
                        }

                        if (part.state === "output-available") {
                          const payload = extractToolPayload(part);

                          if (
                            payload &&
                            typeof (payload as { startedAt?: number }).startedAt === "number"
                          ) {
                            const existing = toolStartTimesRef.current.get(partKey);
                            const serverStart = (payload as { startedAt: number }).startedAt;
                            if (existing) {
                              toolStartTimesRef.current.set(partKey, {
                                ...existing,
                                serverStart,
                              });
                            } else {
                              toolStartTimesRef.current.set(partKey, {
                                localStart: serverStart,
                                serverStart,
                              });
                            }
                          }

                          if (payload && isPlanTool && isPlanToolOutput(payload)) {
                            planToolPayload = payload;
                            return null;
                          }

                          if (payload && isToolErrorOutput(payload)) {
                            return (
                              <div
                                key={`${message.id}-${index}`}
                                className="space-y-2.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-700 transition-colors dark:text-rose-100"
                              >
                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-600 transition-colors dark:text-rose-200">
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
                                      d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  Something went wrong
                                  {typeof payload.durationMs === "number" && (
                                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-rose-600/80 transition-colors dark:text-rose-100/80">
                                      {formatDuration(payload.durationMs)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-rose-700 transition-colors dark:text-rose-100/90">
                                  {payload.errorMessage}
                                </p>
                              </div>
                            );
                          }

                          if (payload && isCourseTool && isCourseToolOutput(payload)) {
                            return null;
                          }

                          if (payload) {
                            return (
                              <Response
                                key={`${message.id}-${index}`}
                                className="w-full rounded-2xl border border-border bg-muted p-4 text-sm text-slate-900 [&_p]:text-slate-900 transition-colors dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:[&_p]:text-slate-100"
                              >
                                {typeof payload === "string"
                                  ? payload
                                  : `\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``}
                              </Response>
                            );
                          }
                        }
                      }

                      return null;
                    },
                  );

                  const planOutput = planToolPayload as PlanToolOutput | null;

                  const renderedPlan =
                    planOutput && planOutput.plan ? (
                      <Response
                        key="plan-content"
                        className="mt-2 w-full rounded-2xl border border-border bg-muted p-4 text-sm text-slate-900 [&_p]:text-slate-900 transition-colors dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:[&_p]:text-slate-100"
                      >
                        {planOutput.plan}
                      </Response>
                    ) : null;

                  const planActionChips =
                    planOutput?.ctaSuggestions && planOutput.ctaSuggestions.length > 0 ? (
                      <div className="mt-3 flex w-full flex-wrap items-center gap-2">
                        {planOutput.ctaSuggestions.map((cta) => {
                          const messageText = cta.message?.trim() ?? "";
                          return (
                            <button
                              key={cta.label}
                              type="button"
                              onClick={() => {
                                if (status === "streaming") return;
                                if (!messageText) return;
                                onSendMessage(messageText);
                              }}
                              disabled={status === "streaming" || !messageText}
                              className="inline-flex items-center rounded-full border border-foreground/10 bg-foreground px-3 py-1 text-xs font-semibold uppercase tracking-wide text-background transition hover:bg-foreground/90 hover:text-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10 dark:focus:ring-indigo-500 dark:focus:ring-offset-slate-950"
                            >
                              {cta.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null;

                  return (
                    <Message from={message.role} key={message.id ?? `message-${messageIndex}`}>
                      <MessageContent
                        variant="flat"
                        className={cn(
                          "max-w-3xl space-y-1 rounded-xl px-3 py-2 text-sm leading-6 transition-colors",
                          isUser
                            ? "bg-primary text-white shadow-sm dark:bg-indigo-500/45 dark:text-white/95"
                            : "bg-slate-100 text-slate-900 shadow-sm dark:bg-slate-900/45 dark:text-slate-100",
                          "flex-col items-stretch",
                        )}
                      >
                        {partNodes}
                        {renderedPlan}
                        {planActionChips}
                      </MessageContent>
                    </Message>
                  );
                })}

                {shouldShowTypingIndicator && (
                  <Message from="assistant">
                    <MessageContent
                      variant="flat"
                      className="inline-flex items-center gap-3 whitespace-nowrap rounded-2xl bg-muted px-5 py-3 text-sm text-muted-foreground transition-colors dark:bg-white/10 dark:text-slate-300"
                    >
                      <Loader size={20} />
                      <span className="animate-pulse">Thinking...</span>
                    </MessageContent>
                  </Message>
                )}

              </>
            )}
          </ConversationContent>
          <ConversationScrollButton className="border border-border bg-muted text-foreground transition hover:bg-accent hover:text-accent-foreground dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-100 dark:hover:border-white/20 dark:hover:bg-white/15" />
        </Conversation>
      </div>

      <div className="border-t border-border bg-transparent px-4 pb-6 pt-4 transition-colors sm:px-6 dark:border-white/10">
        {isLocked ? (
          <div className="mx-auto mb-3 w-full max-w-4xl rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
            This conversation already produced a course. Sending new messages is disabled to
            keep the plan in sync.
          </div>
        ) : null}
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-4xl items-center gap-2 rounded-full border border-border bg-card p-2 shadow-lg transition-colors backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_20px_50px_rgba(15,23,42,0.45)]"
        >
          <textarea
            ref={textareaRef}
            className="max-h-32 min-h-[3rem] flex-1 resize-none rounded-full border border-transparent bg-transparent px-5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:placeholder:text-slate-400"
            value={input}
            placeholder={
              isLocked
                ? "A course has already been generated for this chat."
                : "Ask for a course, outline a goal, or iterate on the plan..."
            }
            onChange={(event) => {
              setInput(event.target.value);
              resetTextareaHeight(event.target);
            }}
            onKeyDown={handleKeyDown}
            disabled={isLocked}
            rows={1}
            style={{
              height: "auto",
              overflowY: input.split("\n").length > 3 ? "auto" : "hidden",
            }}
            onInput={(event) => {
              resetTextareaHeight(event.target as HTMLTextAreaElement);
            }}
          />
          <button
            type="submit"
            disabled={status === "streaming" || !input.trim() || isLocked}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.45)] transition hover:shadow-[0_0_45px_rgba(99,102,241,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "streaming" ? (
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
              <svg
                className="h-5 w-5"
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
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
