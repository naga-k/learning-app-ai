'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { getToolOrDynamicToolName, isToolOrDynamicToolUIPart, type UIMessage } from 'ai';
import { ArrowLeft, BookOpen, List, LogOut } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChatPanel } from '@/components/chat/chat-panel';
import { CourseWorkspace } from '@/components/course/course-workspace';
import {
  isCourseToolOutput,
  type CourseToolOutput,
} from '@/lib/ai/tool-output';
import { useSupabase } from '@/components/supabase-provider';
import {
  NavigationRail,
  type NavigationRailItem,
} from '@/components/course/navigation-rail';
import { ThemeToggle } from '@/components/theme/theme-toggle';

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
  const creatingSessionRef = useRef<Promise<string> | null>(null);
  const pendingInitialMessageRef = useRef<string | null>(null);
  const { supabase } = useSupabase();
  const [mobileMenuExpanded, setMobileMenuExpanded] = useState(false);

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

  const courseStructured = courseState?.output.courseStructured;
  const courseSummary = courseState?.output.course;
  const chatLocked = Boolean(courseStructured);
  const showCourseToggle = chatLocked;
  const showCourseWorkspace =
    viewMode === 'course' && Boolean(courseStructured);

  const handleNavigateDashboard = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  const openCourseWorkspace = useCallback(() => {
    setViewMode('course');
  }, [setViewMode]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
  }, [router, supabase]);

  const chatPrimaryItems = useMemo<NavigationRailItem[]>(() => {
    if (!chatLocked) {
      return [];
    }

    return [
      {
        key: 'course',
        label: 'Course',
        icon: BookOpen,
        onClick: openCourseWorkspace,
        active: showCourseWorkspace,
      },
    ];
  }, [chatLocked, openCourseWorkspace, showCourseWorkspace]);

  const chatSecondaryItems = useMemo<NavigationRailItem[]>(
    () => [
      {
        key: 'sign-out',
        label: 'Sign out',
        icon: LogOut,
        onClick: handleSignOut,
      },
    ],
    [handleSignOut],
  );

  const ensureSessionId = useCallback(async () => {
    if (sessionId) return sessionId;
    if (creatingSessionRef.current) return creatingSessionRef.current;

    const promise = (async () => {
      const response = await fetch('/api/chat/session', { method: 'POST' });
      if (!response.ok) {
        throw new Error('We were unable to start a new chat. Please try again.');
      }

      const data = await response.json();
      setSessionError(null);
      setSessionId(data.sessionId);
      router.replace(`/chat?session=${data.sessionId}`);
      return data.sessionId;
    })();

    creatingSessionRef.current = promise;

    try {
      const id = await promise;
      return id;
    } catch (error) {
      setSessionError('We were unable to start a new chat. Please try again.');
      throw error;
    } finally {
      creatingSessionRef.current = null;
    }
  }, [router, sessionId]);

  useEffect(() => {
    if (viewMode !== 'chat') return;
    const container = scrollContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      if (!scrollContainerRef.current) return;
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'auto',
      });
    });
  }, [messages.length, viewMode]);

  useEffect(() => {
    let cancelled = false;

    async function ensureSession() {
      const existingSessionId = sessionParam;

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

      setInitializingSession(false);
    }

    ensureSession();

    return () => {
      cancelled = true;
    };
  }, [sessionParam, setMessages]);

  const sendMessageWithSession = useCallback(
    (text: string) => {
      if (chatLocked) return;
      if (!sessionId) {
        pendingInitialMessageRef.current = text;
        ensureSessionId().catch(() => {
          pendingInitialMessageRef.current = null;
        });
        return;
      }
      sendMessage({ text });
    },
    [chatLocked, ensureSessionId, sendMessage, sessionId],
  );

  useEffect(() => {
    if (sessionId) return;
    if (hasSentInitialPromptRef.current) return;
    if (!promptParam || promptParam.trim().length === 0) return;
    if (chatLocked) return;

    hasSentInitialPromptRef.current = true;
    pendingInitialMessageRef.current = promptParam;
    ensureSessionId().catch(() => {
      hasSentInitialPromptRef.current = false;
      pendingInitialMessageRef.current = null;
    });
  }, [chatLocked, ensureSessionId, promptParam, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const pending = pendingInitialMessageRef.current;
    if (!pending) return;
    pendingInitialMessageRef.current = null;

    setTimeout(() => {
      if (chatLocked) return;
      sendMessage({ text: pending });
    }, 0);
  }, [chatLocked, sendMessage, sessionId]);

  if (sessionError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground transition-colors">
        <p>{sessionError}</p>
        <button
          type="button"
          onClick={() => {
            setSessionError(null);
            setInitializingSession(true);
            hasSentInitialPromptRef.current = false;
          }}
          className="mt-4 inline-flex items-center justify-center rounded-full border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15 dark:hover:text-white dark:focus-visible:ring-offset-slate-950"
        >
          Try again
        </button>
      </div>
    );
  }

  if (initializingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground transition-colors">
        Preparing your workspace...
      </div>
    );
  }

  const headerBar = (
    <div className="sticky top-0 z-30 flex w-full items-center justify-between gap-3 border-b border-border bg-white/70 px-4 py-6 text-foreground shadow-sm backdrop-blur-xl transition-colors sm:px-6 dark:border-white/5 dark:bg-slate-950/80 dark:text-slate-100">
      {viewMode === 'course' ? (
        <button
          type="button"
          onClick={() => setMobileMenuExpanded((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-100 dark:shadow-[0_0_30px_rgba(99,102,241,0.25)] dark:hover:border-white/20 dark:hover:bg-white/15 dark:focus-visible:ring-offset-slate-950 lg:hidden"
        >
          <List className="h-4 w-4" />
          Menu
        </button>
      ) : <div />}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {showCourseToggle ? (
          viewMode === 'chat' ? (
            <button
              type="button"
              onClick={() => setViewMode('course')}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-100 dark:shadow-[0_0_30px_rgba(99,102,241,0.25)] dark:hover:border-white/20 dark:hover:bg-white/15 dark:focus-visible:ring-offset-slate-950"
            >
              <BookOpen className="h-4 w-4" />
              Open course workspace
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setViewMode('chat')}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-100 dark:shadow-[0_0_30px_rgba(99,102,241,0.25)] dark:hover:border-white/20 dark:hover:bg-white/15 dark:focus-visible:ring-offset-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to chat
            </button>
          )
        ) : null}
      </div>
    </div>
  );

  if (showCourseWorkspace && courseStructured) {
    return (
      <div className="flex h-screen w-full overflow-x-hidden bg-background text-foreground transition-colors">
        <CourseWorkspace
          course={courseStructured}
          summary={courseSummary}
          onBack={() => setViewMode('chat')}
          headerSlot={headerBar}
          mobileMenuExpanded={mobileMenuExpanded}
          setMobileMenuExpanded={setMobileMenuExpanded}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground transition-colors">
      <div className="hidden lg:flex">
        <NavigationRail
          primaryItems={chatPrimaryItems}
          secondaryItems={chatSecondaryItems}
          onNavigateDashboard={handleNavigateDashboard}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {headerBar}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-10 pt-6 sm:px-6 lg:pb-12"
          >
            <div className="flex min-h-[60vh] flex-1 overflow-hidden rounded-[26px] border border-border bg-card transition-colors dark:border-white/8 dark:bg-white/[0.04]">
              <ChatPanel
                messages={messages}
                status={status}
                onSendMessage={sendMessageWithSession}
                isLocked={chatLocked}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
