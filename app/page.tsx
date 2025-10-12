'use client';

import { useChat } from '@ai-sdk/react';
import { getToolOrDynamicToolName, isToolOrDynamicToolUIPart } from 'ai';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Loader } from '@/components/ai-elements/loader';
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Response } from '@/components/ai-elements/response';
import { CourseWorkspace } from '@/components/course/course-workspace';
import {
  hasRenderableAssistantContent,
  isCourseToolOutput,
  isPlanToolOutput,
  type CourseToolOutput,
} from '@/lib/ai/tool-output';
import { cn } from '@/lib/utils';

type CourseSnapshot = {
  id: string;
  output: CourseToolOutput;
};

export default function Chat() {
  const [input, setInput] = useState('');
  const [viewMode, setViewMode] = useState<'chat' | 'course'>('chat');
  const { messages, sendMessage, status } = useChat();

  const [courseState, setCourseState] = useState<CourseSnapshot | null>(null);
  const courseRef = useRef<string | null>(null);

  const latestCourse = useMemo<CourseSnapshot | null>(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      for (
        let partIndex = message.parts.length - 1;
        partIndex >= 0;
        partIndex -= 1
      ) {
        const part = message.parts[partIndex];

        if (!isToolOrDynamicToolUIPart(part)) continue;
        if (getToolOrDynamicToolName(part) !== 'generate_course') continue;
        if (part.state !== 'output-available' || part.preliminary) continue;

        const payload =
          (part as { output?: unknown }).output ??
          (part as { result?: unknown }).result;
        if (isCourseToolOutput(payload)) {
          return {
            id: `${message.id}-${partIndex}`,
            output: payload,
          };
        }
      }
    }
    return null;
  }, [messages]);

  useEffect(() => {
    if (!latestCourse) return;
    if (courseRef.current === latestCourse.id) return;

    courseRef.current = latestCourse.id;
    setCourseState(latestCourse);
    setViewMode('course');
  }, [latestCourse]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (input.trim() && status !== 'streaming') {
        handleSubmit(event as unknown as React.FormEvent);
      }
    }
  };

  const renderableMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          message.role !== 'assistant' || hasRenderableAssistantContent(message),
      ),
    [messages],
  );

  const lastAssistantMessage = useMemo(
    () => [...messages].reverse().find((msg) => msg.role === 'assistant') ?? null,
    [messages],
  );

  const shouldShowTypingIndicator =
    status === 'streaming' && !hasRenderableAssistantContent(lastAssistantMessage);

  const showCourseToggle = Boolean(courseState?.output.courseStructured);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.35),_transparent_55%)] blur-3xl" />
        <div
          className="absolute inset-0 opacity-40 mix-blend-screen"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148, 163, 184, 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px)',
            backgroundSize: '42px 42px',
            maskImage:
              'radial-gradient(circle at center, rgba(0,0,0,0.85) 0%, transparent 70%)',
            WebkitMaskImage:
              'radial-gradient(circle at center, rgba(0,0,0,0.85) 0%, transparent 70%)',
          }}
        />
      </div>

      <header className="sticky top-0 z-10 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-4 py-6 sm:px-6">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-indigo-300/80">
              <span className="inline-flex size-1.5 rounded-full bg-indigo-400 shadow-[0_0_12px_rgba(129,140,248,0.9)]" />
              Learn Engine
            </p>
            <h1 className="text-3xl font-semibold md:text-[2.35rem]">
              Course Architect
            </h1>
            <p className="text-sm text-slate-400 md:text-base">
              Set your goal, refine the roadmap, and build lessons that fit the way you learn.
            </p>
          </div>

          {showCourseToggle && (
            viewMode === 'chat' ? (
              <button
                type="button"
                onClick={() =>
                  setViewMode((mode) => (mode === 'course' ? 'chat' : 'course'))
                }
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-slate-100 shadow-[0_0_30px_rgba(99,102,241,0.25)] transition hover:border-white/20 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                <BookOpen className="h-4 w-4" />
                Open course workspace
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setViewMode('chat')}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-slate-100 shadow-[0_0_30px_rgba(99,102,241,0.25)] transition hover:border-white/20 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to chat
              </button>
            )
          )}
        </div>
      </header>

      <main className="flex flex-1 justify-center px-4 pb-10 pt-6 sm:px-6 lg:pb-12">
        {viewMode === 'course' && courseState?.output.courseStructured ? (
          <div className="flex w-full max-w-5xl flex-1">
            <div className="flex min-h-[60vh] w-full flex-1 overflow-hidden rounded-[26px] border border-white/8 bg-white/[0.04]">
              <CourseWorkspace
                course={courseState.output.courseStructured}
                summary={courseState.output.course}
                onBack={() => setViewMode('chat')}
              />
            </div>
          </div>
        ) : (
          <div className="flex w-full max-w-5xl flex-1 flex-col gap-6">
            <div className="relative flex min-h-[60vh] flex-1 flex-col overflow-hidden rounded-[26px] border border-white/8 bg-white/[0.04]">
              <div className="relative flex-1 overflow-hidden">
                <Conversation className="flex h-full flex-col">
                  <ConversationContent className="flex flex-1 flex-col gap-2.5 px-6 py-8 sm:px-10">
                    {messages.length === 0 ? (
                      <ConversationEmptyState className="rounded-3xl border border-white/10 bg-white/[0.04] px-8 py-12 text-slate-200 shadow-[0_0_45px_rgba(15,23,42,0.75)] backdrop-blur-xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.45em] text-indigo-200">
                          Initiate
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-white">
                            Learn something new?
                          </h3>
                          <p className="text-sm text-slate-300">
                            Drop a goal, topic, or skill and we’ll map the path to get
                            you there.
                          </p>
                        </div>
                      </ConversationEmptyState>
                    ) : (
                      <>
                        {renderableMessages.map((message) => {
                          const isUser = message.role === 'user';
                          return (
                            <Message from={message.role} key={message.id}>
                              <MessageContent
                                variant="flat"
                                className={cn(
                                  'max-w-3xl space-y-1 rounded-xl px-3 py-2 text-sm leading-6 transition-colors',
                                  isUser
                                    ? 'bg-indigo-500/45 text-white/95'
                                    : 'bg-slate-900/45 text-slate-100',
                                )}
                              >
                                {message.parts.map((part, index) => {
                                  if (part.type === 'text') {
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
                                    const isCourseTool =
                                      toolName === 'generate_course';
                                    const isPlanTool = toolName === 'generate_plan';
                                    const streamingMessage = isCourseTool
                                      ? 'Synthesizing your immersive course...'
                                      : isPlanTool
                                        ? 'Designing your learning blueprint...'
                                        : 'Working on your request...';
                                    const isStreamingState =
                                      part.state === 'input-streaming' ||
                                      part.state === 'input-available' ||
                                      (part.state === 'output-available' && part.preliminary);

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

                                    if (part.state === 'output-error') {
                                      return (
                                        <div
                                          key={`${message.id}-${index}`}
                                          className="mt-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
                                        >
                                          {part.errorText ??
                                            'Something went wrong while running the tool.'}
                                        </div>
                                      );
                                    }

                                    if (part.state === 'output-available') {
                                      const payload =
                                        (part as { output?: unknown }).output ??
                                        (part as { result?: unknown }).result;

                                      if (
                                        payload &&
                                        isPlanTool &&
                                        isPlanToolOutput(payload)
                                      ) {
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
                                              Ready for the next step? Ask me to
                                              “Generate the course” when you’re
                                              happy with this plan.
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
                                            className="space-y-2.5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-xs text-emerald-100"
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
                                            {typeof payload === 'string'
                                              ? payload
                                              : `\`\`\`json\n${JSON.stringify(
                                                  payload,
                                                  null,
                                                  2,
                                                )}\n\`\`\``}
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
                              className="flex items-center gap-3 rounded-2xl bg-white/10 px-5 py-3 text-sm text-slate-300"
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
                      className="h-12 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                      value={input}
                      placeholder="Ask for a course, outline a goal, or iterate on the plan..."
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={status === 'streaming'}
                      rows={1}
                      style={{
                        height: 'auto',
                        overflowY:
                          input.split('\n').length > 3 ? 'auto' : 'hidden',
                      }}
                      onInput={(event) => {
                        const target = event.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${Math.min(
                          target.scrollHeight,
                          200,
                        )}px`;
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={status === 'streaming' || !input.trim()}
                    className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 px-5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(99,102,241,0.45)] transition hover:shadow-[0_0_45px_rgba(99,102,241,0.6)] focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {status === 'streaming' ? (
                      <svg
                        className="h-5 w-5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
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
          </div>
        )}
      </main>
    </div>
  );
}
