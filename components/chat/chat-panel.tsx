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
} from "@/lib/ai/tool-output";
import { cn } from "@/lib/utils";

type ChatPanelProps = {
  messages: UIMessage[];
  status: UseChatHelpers<UIMessage>["status"];
  onSendMessage: (text: string) => void;
  onAppendAssistantMessage: (text: string) => void;
};

export function ChatPanel({
  messages,
  status,
  onSendMessage,
  onAppendAssistantMessage,
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

  const planMessagesNeedingFollowUp = useMemo(() => {
    const pending: string[] = [];

    messages.forEach((message, index) => {
      if (message.role !== "assistant") return;
      if (!Array.isArray(message.parts)) return;

      const hasPlanPayload = message.parts.some((part) => {
        if (!isToolOrDynamicToolUIPart(part)) return false;
        if (isPreliminaryPart(part)) return false;
        if (part.state !== "output-available") return false;

        const payload = extractToolPayload(part);

        return payload && isPlanToolOutput(payload);
      });

      if (!hasPlanPayload) return;

      let assistantTextAfterPlan = false;

      for (let cursor = index + 1; cursor < messages.length; cursor += 1) {
        const nextMessage = messages[cursor];

        if (nextMessage.role === "user") {
          break;
        }

        if (nextMessage.role === "assistant") {
          const hasTextPart = nextMessage.parts.some(
            (part) => part.type === "text" && Boolean(part.text?.trim().length),
          );

          if (hasTextPart) {
            assistantTextAfterPlan = true;
            break;
          }

          const nextHasPlanPayload = nextMessage.parts.some((part) => {
            if (!isToolOrDynamicToolUIPart(part)) return false;
            if (isPreliminaryPart(part)) return false;
            if (part.state !== "output-available") return false;

            const payload = extractToolPayload(part);

            return payload && isPlanToolOutput(payload);
          });

          if (nextHasPlanPayload) {
            break;
          }
        }
      }

      if (!assistantTextAfterPlan) {
        pending.push(message.id);
      }
    });

    return pending;
  }, [messages]);

  const handledPlanIdsRef = useRef(new Set<string>());

  useEffect(() => {
    planMessagesNeedingFollowUp.forEach((planId) => {
      if (handledPlanIdsRef.current.has(planId)) return;
      handledPlanIdsRef.current.add(planId);
      onAppendAssistantMessage(
        "How does this plan look? Want tweaks before we generate the course?",
      );
    });
  }, [planMessagesNeedingFollowUp, onAppendAssistantMessage]);

  const renderableMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          message.role !== "assistant" || hasRenderableAssistantContent(message),
      ),
    [messages],
  );

  const lastAssistantMessage = useMemo(
    () => [...messages].reverse().find((msg) => msg.role === "assistant") ?? null,
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
    if (!input.trim()) return;
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
      if (input.trim() && status !== "streaming") {
        handleSubmit(event as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  return (
    <div className="relative flex min-h-[60vh] flex-1 flex-col overflow-hidden rounded-[26px] border border-white/8 bg-white/[0.04]">
      <div className="relative flex-1 overflow-hidden">
        <Conversation className="flex h-full flex-col">
          <ConversationContent className="flex flex-1 flex-col gap-2.5 px-6 py-8 sm:px-10">
            {messages.length === 0 ? (
              <ConversationEmptyState className="space-y-2 rounded-3xl border border-white/10 bg-white/[0.04] px-8 py-12 text-left text-slate-200 shadow-[0_0_45px_rgba(15,23,42,0.75)] backdrop-blur-xl">
                <h3 className="text-lg font-semibold text-white">
                  Learn something new?
                </h3>
                <p className="text-sm text-slate-300">
                  Drop a goal, topic, or skill and we’ll map the path to get you there.
                </p>
              </ConversationEmptyState>
            ) : (
              <>
                {renderableMessages.map((message, messageIndex) => {
                  const isUser = message.role === "user";
              return (
                  <Message from={message.role} key={message.id ?? `message-${messageIndex}`}>
                    <MessageContent
                      variant="flat"
                      className={cn(
                        "max-w-3xl space-y-1 rounded-xl px-3 py-2 text-sm leading-6 transition-colors",
                        isUser
                          ? "bg-indigo-500/45 text-white/95"
                          : "bg-slate-900/45 text-slate-100",
                      )}
                    >
                      {(Array.isArray(message.parts) ? message.parts : []).map((part, index) => {
                        const partKey = `${message.id}-${index}`;
                        if (part.type === "text") {
                          return (
                            <Response
                              key={`${message.id}-${index}`}
                                className="prose-sm prose-invert max-w-none text-slate-100"
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
                                  className="mt-2 flex items-center gap-2 text-sm text-slate-300"
                                >
                                  <Loader size={16} />
                                  <span className="animate-pulse">{streamingMessage}</span>
                                  {elapsedLabel && (
                                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
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
                                  className="mt-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
                                >
                                  {part.errorText ??
                                    "Something went wrong while running the tool."}
                                </div>
                              );
                            }

                            if (part.state === "output-available") {
                              const payload = extractToolPayload(part);

                              if (payload && typeof (payload as { startedAt?: number }).startedAt === "number") {
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
                                return (
                                  <div
                                    key={`${message.id}-${index}`}
                                    className="space-y-3 rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-4 text-slate-100"
                                  >
                                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-indigo-200">
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
                                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                      </svg>
                                      Learning plan generated
                                      {typeof payload.durationMs === "number" && (
                                        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-indigo-100/80">
                                          {formatDuration(payload.durationMs)}
                                        </span>
                                      )}
                                    </div>
                                    <Response className="prose-sm prose-invert max-w-none text-slate-100">
                                      {payload.plan}
                                    </Response>
                                  </div>
                                );
                              }

                              if (payload && isToolErrorOutput(payload)) {
                                return (
                                  <div
                                    key={`${message.id}-${index}`}
                                    className="space-y-2.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100"
                                  >
                                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-200">
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
                                        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-rose-100/80">
                                          {formatDuration(payload.durationMs)}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-rose-100/90">
                                      {payload.errorMessage}
                                    </p>
                                  </div>
                                );
                              }

                              if (
                                payload &&
                                isCourseTool &&
                                isCourseToolOutput(payload)
                              ) {
                                return (
                                  <div
                                    key={`${message.id}-${index}`}
                                    className="space-y-2.5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100"
                                  >
                                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-emerald-200">
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
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                      Course generated
                                      {typeof payload.durationMs === "number" && (
                                        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-emerald-100/80">
                                          {formatDuration(payload.durationMs)}
                                        </span>
                                      )}
                                    </div>
                                    <Response className="prose-sm prose-invert max-w-none text-emerald-50">
                                      {payload.course}
                                    </Response>
                                  </div>
                                );
                              }

                              if (payload) {
                                return (
                                  <Response
                                    key={`${message.id}-${index}`}
                                    className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-100"
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
                        })}
                      </MessageContent>
                    </Message>
                  );
                })}

                {shouldShowTypingIndicator && (
                  <Message from="assistant">
                    <MessageContent
                      variant="flat"
                      className="inline-flex items-center gap-3 whitespace-nowrap rounded-2xl bg-white/10 px-5 py-3 text-sm text-slate-300"
                    >
                      <Loader size={20} />
                      <span className="animate-pulse">Thinking...</span>
                    </MessageContent>
                  </Message>
                )}

              </>
            )}
          </ConversationContent>
          <ConversationScrollButton className="border-white/10 bg-white/[0.08] text-slate-100 hover:border-white/20 hover:bg-white/15" />
        </Conversation>
      </div>

      <div className="border-t border-white/10 bg-transparent px-4 pb-6 pt-4 sm:px-6">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-4xl items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-2 shadow-[0_20px_50px_rgba(15,23,42,0.45)] backdrop-blur-xl"
        >
          <textarea
            ref={textareaRef}
            className="max-h-32 min-h-[3rem] flex-1 resize-none rounded-full border border-white/10 bg-white/[0.02] px-5 py-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            value={input}
            placeholder="Ask for a course, outline a goal, or iterate on the plan..."
            onChange={(event) => {
              setInput(event.target.value);
              resetTextareaHeight(event.target);
            }}
            onKeyDown={handleKeyDown}
            disabled={status === "streaming"}
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
            disabled={status === "streaming" || !input.trim()}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.45)] transition hover:shadow-[0_0_45px_rgba(99,102,241,0.6)] focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
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
