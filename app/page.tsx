'use client';

import { useChat } from '@ai-sdk/react';
import { getToolOrDynamicToolName, isToolOrDynamicToolUIPart } from 'ai';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatPanel } from '@/components/chat/chat-panel';
import { CourseWorkspace } from '@/components/course/course-workspace';
import {
  isCourseToolOutput,
  type CourseToolOutput,
} from '@/lib/ai/tool-output';

type CourseSnapshot = {
  id: string;
  output: CourseToolOutput;
};

function createAssistantMessage(text: string) {
  return {
    id: `assistant-follow-up-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    role: 'assistant' as const,
    parts: [
      {
        type: 'text' as const,
        text,
      },
    ],
  };
}

export default function Chat() {
  const [viewMode, setViewMode] = useState<'chat' | 'course'>('chat');
  const { messages, sendMessage, status, setMessages } = useChat();

  const appendAssistantMessage = useCallback(
    (text: string) =>
      setMessages((current) => [...current, createAssistantMessage(text)]),
    [setMessages],
  );

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

  const showCourseToggle = Boolean(courseState?.output.courseStructured);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-4 py-6 sm:px-6">
          <div className="space-y-2">
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
        <div className="flex w-full max-w-5xl flex-1">
          {viewMode === 'course' && courseState?.output.courseStructured ? (
            <div className="flex min-h-[60vh] w-full flex-1 overflow-hidden rounded-[26px] border border-white/8 bg-white/[0.04]">
              <CourseWorkspace
                course={courseState.output.courseStructured}
                summary={courseState.output.course}
                onBack={() => setViewMode('chat')}
              />
            </div>
          ) : (
            <ChatPanel
              messages={messages}
              status={status}
              onSendMessage={(text) => sendMessage({ text })}
              onAppendAssistantMessage={appendAssistantMessage}
            />
          )}
        </div>
      </main>
    </>
  );
}
