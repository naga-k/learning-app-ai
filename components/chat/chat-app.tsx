'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { getToolOrDynamicToolName, isToolOrDynamicToolUIPart, type UIMessage } from 'ai';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

export function ChatApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<'chat' | 'course'>('chat');
  const sessionParam = searchParams.get('session');
  const promptParam = searchParams.get('prompt');
  const [sessionId, setSessionId] = useState<string | null>(sessionParam);
  const [initializingSession, setInitializingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const transport = useMemo(() => {
    if (!sessionId) return undefined;

    return new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest(request) {
        return {
          body: {
            sessionId,
            message: request.messages.at(-1),
          },
        };
      },
    });
  }, [sessionId]);

  const { messages, sendMessage, status, setMessages } = useChat({
    id: sessionId ?? undefined,
    transport,
  });
  const hasSentInitialPromptRef = useRef(false);

  const [courseState, setCourseState] = useState<CourseSnapshot | null>(null);
  const courseRef = useRef<string | null>(null);

  const latestCourse = useMemo<CourseSnapshot | null>(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (!message || !Array.isArray(message.parts)) continue;
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

  useEffect(() => {
    scrollContainerRef.current = document.getElementById(
      'app-scroll-container',
    ) as HTMLDivElement | null;
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      if (!scrollContainerRef.current) return;
      if (viewMode === 'chat') {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'auto',
        });
        return;
      }

      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'auto' });
    });
  }, [messages.length, viewMode]);

  useEffect(() => {
    let cancelled = false;

    async function ensureSession() {
      const existingSessionId = searchParams.get('session');

      if (existingSessionId) {
        const response = await fetch(`/api/chat/session?sessionId=${existingSessionId}`);
        if (!response.ok) {
          setSessionError('This chat session could not be loaded.');
          setInitializingSession(false);
          return;
        }

        const data = await response.json();
        if (cancelled) return;

        setSessionId(data.session.id);
        const storedMessages: UIMessage[] = data.messages.map((row: { content: UIMessage }) => row.content);
        if (storedMessages.length > 0) {
          setMessages(storedMessages);
        }
        setInitializingSession(false);
        return;
      }

      const response = await fetch('/api/chat/session', { method: 'POST' });
      if (!response.ok) {
        setSessionError('We were unable to start a new chat. Please try again.');
        setInitializingSession(false);
        return;
      }

      const data = await response.json();
      if (cancelled) return;

      setSessionId(data.sessionId);
      router.replace(`/chat?session=${data.sessionId}${promptParam ? `&prompt=${encodeURIComponent(promptParam)}` : ''}`);
      setInitializingSession(false);
    }

    ensureSession();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams, setMessages, promptParam]);

  const sendMessageWithSession = useCallback(
    (text: string) => {
      if (!sessionId) return;
      sendMessage({ text });
    },
    [sendMessage, sessionId],
  );

  useEffect(() => {
    if (!sessionId) return;
    if (hasSentInitialPromptRef.current) return;
    if (!promptParam || promptParam.trim().length === 0) return;

    hasSentInitialPromptRef.current = true;
    sendMessageWithSession(promptParam);
    router.replace(`/chat?session=${sessionId}`);
  }, [router, sessionId, promptParam, sendMessageWithSession]);

  if (sessionError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200">
        <p>{sessionError}</p>
        <button
          type="button"
          onClick={() => {
            setSessionError(null);
            setInitializingSession(true);
            hasSentInitialPromptRef.current = false;
          }}
          className="mt-4 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-100"
        >
          Try again
        </button>
      </div>
    );
  }

  if (initializingSession || !sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        Preparing your chat workspace...
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between gap-6 px-4 py-6 sm:px-6">
          <div className="flex-1" />

          {showCourseToggle ? (
            <div className="flex items-center gap-3">
              {viewMode === 'chat' ? (
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
              )}
            </div>
          ) : null}
        </div>
      </header>

      <main className="flex flex-1 px-4 pb-10 pt-6 sm:px-6 lg:pb-12">
        <div className="flex w-full flex-1">
          {viewMode === 'course' && courseState?.output.courseStructured ? (
            <div className="flex min-h-[60vh] w-full flex-1 overflow-hidden rounded-[26px] border border-white/8 bg-white/[0.04]">
              <CourseWorkspace
                course={courseState.output.courseStructured}
                summary={courseState.output.course}
                onBack={() => setViewMode('chat')}
                useGlobalNavigation
              />
            </div>
          ) : (
            <ChatPanel
              messages={messages}
              status={status}
              onSendMessage={sendMessageWithSession}
            />
          )}
        </div>
      </main>
    </>
  );
}
