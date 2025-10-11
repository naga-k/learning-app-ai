'use client';

import { useChat } from '@ai-sdk/react';
import {
  getToolOrDynamicToolName,
  isToolOrDynamicToolUIPart,
  type UIMessage,
} from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Response } from '@/components/ai-elements/response';
import { Loader } from '@/components/ai-elements/loader';
import { CourseWorkspace } from '@/components/course/course-workspace';
import {
  type CourseWithIds,
  type LearningPlanWithIds,
} from '@/lib/curriculum';
import { MessageSquare, BookOpen } from 'lucide-react';

type PlanToolOutput = {
  plan: string;
  structuredPlan?: LearningPlanWithIds;
  summary?: string;
};

type CourseToolOutput = {
  course: string;
  courseStructured?: CourseWithIds;
  summary?: string;
};

type CourseSnapshot = {
  id: string;
  output: CourseToolOutput;
};

const isPlanToolOutput = (value: unknown): value is PlanToolOutput =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'plan' in value &&
      typeof (value as Record<string, unknown>).plan === 'string',
  );

const isCourseToolOutput = (value: unknown): value is CourseToolOutput =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'course' in value &&
      typeof (value as Record<string, unknown>).course === 'string',
  );

const hasRenderableAssistantContent = (message: UIMessage | null): boolean => {
  if (!message || message.role !== 'assistant') return false;
  if (message.parts.length === 0) return false;

  return message.parts.some((part) => {
    if (part.type === 'text') {
      return Boolean(part.text && part.text.trim().length > 0);
    }

    if (!isToolOrDynamicToolUIPart(part)) return false;

    if (
      part.state === 'input-streaming' ||
      part.state === 'input-available' ||
      part.state === 'output-error'
    ) {
      return true;
    }

    if (part.state === 'output-available') {
      if (part.preliminary) return true;

      const payload =
        (part as { output?: unknown }).output ??
        (part as { result?: unknown }).result;

      if (!payload) return false;

      return isPlanToolOutput(payload) || isCourseToolOutput(payload);
    }

    return false;
  });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && status !== 'streaming') {
        handleSubmit(e as unknown as React.FormEvent);
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
    <div className="flex h-screen flex-col bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white/95 shadow-sm backdrop-blur dark:bg-gray-900/80">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              🎓 AI Learning-Plan Assistant
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Shape your learning goal, review the plan, then turn it into a
              fully structured course.
            </p>
          </div>

          {showCourseToggle && (
            <button
              type="button"
              onClick={() =>
                setViewMode((mode) => (mode === 'course' ? 'chat' : 'course'))
              }
              className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-indigo-500/40 dark:bg-transparent dark:text-indigo-300 dark:hover:border-indigo-500/60 dark:hover:text-indigo-200"
            >
              {viewMode === 'course' ? (
                <MessageSquare className="h-4 w-4" />
              ) : (
                <BookOpen className="h-4 w-4" />
              )}
              {viewMode === 'course' ? 'Back to chat' : 'Open course workspace'}
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {viewMode === 'course' && courseState?.output.courseStructured ? (
          <CourseWorkspace
            course={courseState.output.courseStructured}
            summary={courseState.output.course}
            onBack={() => setViewMode('chat')}
          />
        ) : (
          <div className="flex h-full flex-col">
            <div className="relative flex-1">
              <Conversation className="absolute inset-0">
                <ConversationContent>
                  {messages.length === 0 ? (
                    <ConversationEmptyState
                      icon={<MessageSquare className="h-12 w-12" />}
                      title="Ready to start learning?"
                      description="Say hi or tell me what you’d like to learn."
                    />
                  ) : (
                    <>
                      {renderableMessages.map((message) => (
                        <Message from={message.role} key={message.id}>
                          <MessageContent>
                            {message.parts.map((part, index) => {
                              if (part.type === 'text') {
                                return (
                                  <Response key={`${message.id}-${index}`}>
                                    {part.text}
                                  </Response>
                                );
                              }

                              if (isToolOrDynamicToolUIPart(part)) {
                                const toolName = getToolOrDynamicToolName(part);
                                const isCourseTool = toolName === 'generate_course';
                                const isPlanTool = toolName === 'generate_plan';
                                const streamingMessage = isCourseTool
                                  ? 'Creating your personalized course content...'
                                  : isPlanTool
                                    ? 'Creating your learning plan...'
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
                                      className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
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
                                      className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm dark:border-red-500/60 dark:bg-red-500/10 dark:text-red-200"
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

                                  if (payload && isPlanTool && isPlanToolOutput(payload)) {
                                    return (
                                      <div
                                        key={`${message.id}-${index}`}
                                        className="mt-4 space-y-4"
                                      >
                                        <div className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
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
                                        <Response className="rounded-xl border border-gray-200/70 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/80">
                                          {payload.plan}
                                        </Response>
                                        <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-800 shadow-sm dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
                                          Ready for the next step? Ask me to
                                          “Generate the course” when you’re
                                          happy with this plan.
                                        </div>
                                      </div>
                                    );
                                  }

                                  if (payload && isCourseTool && isCourseToolOutput(payload)) {
                                    return (
                                      <div
                                        key={`${message.id}-${index}`}
                                        className="mt-4 space-y-3"
                                      >
                                        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
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
                                        <Response className="rounded-xl border border-emerald-200/70 bg-white/90 p-4 text-sm text-gray-800 shadow-sm backdrop-blur dark:border-emerald-500/40 dark:bg-gray-900/80 dark:text-gray-200">
                                          {payload.course}
                                        </Response>
                                      </div>
                                    );
                                  }

                                  if (payload) {
                                    return (
                                      <Response
                                        key={`${message.id}-${index}`}
                                        className="mt-4 rounded-xl border border-gray-200/70 bg-white/90 p-4 text-sm text-gray-700 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-200"
                                      >
                                        {typeof payload === 'string'
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
                      ))}

                      {shouldShowTypingIndicator && (
                        <Message from="assistant">
                          <MessageContent>
                            <div className="flex items-center gap-3 py-2 text-gray-500 dark:text-gray-400">
                              <Loader size={20} />
                              <span className="text-sm animate-pulse">
                                Thinking...
                              </span>
                            </div>
                          </MessageContent>
                        </Message>
                      )}
                    </>
                  )}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
            </div>

            <div className="border-t border-gray-200 bg-white/95 shadow-lg backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
              <form
                onSubmit={handleSubmit}
                className="mx-auto flex w-full max-w-5xl gap-3 px-4 py-4"
              >
                <textarea
                  className="flex-1 rounded-2xl border border-gray-300 bg-white px-6 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                  value={input}
                  placeholder="Type your message... (Shift+Enter for a new line)"
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={status === 'streaming'}
                  rows={1}
                  style={{
                    height: 'auto',
                    overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden',
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
                <button
                  type="submit"
                  disabled={status === 'streaming' || !input.trim()}
                  className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
        )}
      </main>
    </div>
  );
}
