"use client";

import { useMemo, useRef, useState } from "react";
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
} from "@/lib/ai/tool-output";
import { cn } from "@/lib/utils";

type ChatPanelProps = {
  messages: UIMessage[];
  status: UseChatHelpers<UIMessage>["status"];
  onSendMessage: (text: string) => void;
};

export function ChatPanel({
  messages,
  status,
  onSendMessage,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
                {renderableMessages.map((message) => {
                  const isUser = message.role === "user";
                  return (
                    <Message from={message.role} key={message.id}>
                      <MessageContent
                        variant="flat"
                        className={cn(
                          "max-w-3xl space-y-1 rounded-xl px-3 py-2 text-sm leading-6 transition-colors",
                          isUser
                            ? "bg-indigo-500/45 text-white/95"
                            : "bg-slate-900/45 text-slate-100",
                        )}
                      >
                        {message.parts.map((part, index) => {
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
                              (part.state === "output-available" && part.preliminary);

                            if (isStreamingState) {
                              return (
                                <div
                                  key={`${message.id}-${index}`}
                                  aria-live="polite"
                                  className="mt-2 flex items-center gap-2 text-sm text-slate-300"
                                >
                                  <Loader size={16} />
                                  <span className="animate-pulse">
                                    {streamingMessage}
                                  </span>
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
                              const payload =
                                (part as { output?: unknown }).output ??
                                (part as { result?: unknown }).result;

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
                                    </div>
                                    <Response className="prose-sm prose-invert max-w-none text-slate-100">
                                      {payload.plan}
                                    </Response>
                                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                                      Want tweaks before we move on? Ask me to adjust
                                      the plan—or say “Generate the course” when
                                      you’re ready.
                                    </div>
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

      <div className="border-t border-white/10 bg-gradient-to-b from-white/0 to-white/[0.05] px-4 py-4 sm:px-6">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-4xl items-end gap-3"
        >
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              className="h-12 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>
          <button
            type="submit"
            disabled={status === "streaming" || !input.trim()}
            className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 px-5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(99,102,241,0.45)] transition hover:shadow-[0_0_45px_rgba(99,102,241,0.6)] focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
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
