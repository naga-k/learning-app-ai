'use client';

import { useCallback, useMemo, useState, type UIEvent } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Brain, LogOut, Send } from 'lucide-react';
import type {
  DashboardCourse,
  DashboardCourseCursor,
} from '@/lib/dashboard/courses';
import type {
  DashboardSession,
  DashboardSessionCursor,
} from '@/lib/dashboard/sessions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSidebarContent } from '@/components/dashboard/sidebar-provider';
import { useSupabase } from '@/components/supabase-provider';

type DashboardViewProps = {
  initialCourses: DashboardCourse[];
  initialCourseNextCursor: DashboardCourseCursor | null;
  initialCourseTotalCount: number;
  coursePageSize: number;
  initialSessions: DashboardSession[];
  initialNextCursor: DashboardSessionCursor | null;
  sessionPageSize: number;
};

export function DashboardView({
  initialCourses,
  initialCourseNextCursor,
  initialCourseTotalCount,
  coursePageSize,
  initialSessions,
  initialNextCursor,
  sessionPageSize,
}: DashboardViewProps) {
  const router = useRouter();
  const { supabase } = useSupabase();
  const [draftMessage, setDraftMessage] = useState('');
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [allCourses, setAllCourses] = useState<DashboardCourse[]>(() => [...initialCourses]);
  const [courseNextCursor, setCourseNextCursor] = useState<DashboardCourseCursor | null>(
    initialCourseNextCursor,
  );
  const [courseTotalCount, setCourseTotalCount] = useState(initialCourseTotalCount);
  const [loadingMoreCourses, setLoadingMoreCourses] = useState(false);
  const [courseLoadError, setCourseLoadError] = useState<string | null>(null);
  const [allSessions, setAllSessions] = useState<DashboardSession[]>(() => [...initialSessions]);
  const [sessionNextCursor, setSessionNextCursor] = useState<DashboardSessionCursor | null>(
    initialNextCursor,
  );
  const [loadingMoreSessions, setLoadingMoreSessions] = useState(false);
  const [sessionLoadError, setSessionLoadError] = useState<string | null>(null);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
  }, [router, supabase]);

  const handleOpenCourse = useCallback(
    (course: DashboardCourse) => {
      const targetUrl = course.sessionId
        ? `/chat?session=${course.sessionId}`
        : `/chat?course=${course.id}`;

      router.push(targetUrl);
    },
    [router],
  );

  const stats = useMemo(
    () => ({
      total: courseTotalCount,
    }),
    [courseTotalCount],
  );

  const generatedSessions = useMemo(
    () => allSessions.filter((session) => session.hasGeneratedCourse),
    [allSessions],
  );

  const sessionsToDisplay = useMemo(() => {
    if (showAllSessions) return allSessions;
    return allSessions.filter((session) => !session.hasGeneratedCourse);
  }, [allSessions, showAllSessions]);

  const emptySessionsMessage = useMemo(() => {
    if (allSessions.length === 0) {
      return 'No conversations yet. Start chatting to see sessions here.';
    }

    if (!showAllSessions && sessionsToDisplay.length === 0) {
      return 'All recent chats have generated courses. Use View generated to revisit them.';
    }

    return 'No conversations yet. Start chatting to see sessions here.';
  }, [allSessions.length, sessionsToDisplay.length, showAllSessions]);

  const hasMoreCourses = Boolean(courseNextCursor);
  const hasMoreSessions = Boolean(sessionNextCursor);

  const loadMoreCourses = useCallback(async () => {
    if (!courseNextCursor || loadingMoreCourses) return;

    setLoadingMoreCourses(true);
    setCourseLoadError(null);

    try {
      const params = new URLSearchParams({
        limit: String(coursePageSize),
        cursorUpdatedAt: courseNextCursor.updatedAt,
        cursorId: courseNextCursor.id,
      });

      const response = await fetch(`/api/dashboard/courses?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to load courses (${response.status})`);
      }

      const data: {
        courses: DashboardCourse[];
        nextCursor: DashboardCourseCursor | null;
        totalCount: number;
      } = await response.json();

      setAllCourses((previous) => {
        if (data.courses.length === 0) {
          return previous;
        }

        const existingIds = new Set(previous.map((course) => course.id));
        const merged = [...previous];

        data.courses.forEach((course) => {
          if (!existingIds.has(course.id)) {
            merged.push(course);
            existingIds.add(course.id);
          }
        });

        return merged;
      });

      setCourseNextCursor(data.nextCursor ?? null);
      if (typeof data.totalCount === 'number') {
        setCourseTotalCount(data.totalCount);
      }
    } catch (error) {
      console.error('Failed to load more dashboard courses', error);
      setCourseLoadError('Unable to load more courses. Please try again.');
    } finally {
      setLoadingMoreCourses(false);
    }
  }, [courseNextCursor, coursePageSize, loadingMoreCourses]);

  const loadMoreSessions = useCallback(async () => {
    if (!sessionNextCursor || loadingMoreSessions) return;

    setLoadingMoreSessions(true);
    setSessionLoadError(null);

    try {
      const params = new URLSearchParams({
        limit: String(sessionPageSize),
        cursorUpdatedAt: sessionNextCursor.updatedAt,
        cursorId: sessionNextCursor.id,
      });

      const response = await fetch(`/api/dashboard/sessions?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to load sessions (${response.status})`);
      }

      const data: {
        sessions: DashboardSession[];
        nextCursor: DashboardSessionCursor | null;
      } = await response.json();

      setAllSessions((previous) => {
        if (data.sessions.length === 0) {
          return previous;
        }

        const existingIds = new Set(previous.map((session) => session.id));
        const merged = [...previous];

        data.sessions.forEach((session) => {
          if (!existingIds.has(session.id)) {
            merged.push(session);
            existingIds.add(session.id);
          }
        });

        return merged;
      });

      setSessionNextCursor(data.nextCursor ?? null);
    } catch (error) {
      console.error('Failed to load more dashboard sessions', error);
      setSessionLoadError('Unable to load more chats. Please try again.');
    } finally {
      setLoadingMoreSessions(false);
    }
  }, [loadingMoreSessions, sessionNextCursor, sessionPageSize]);

  const handleSessionsScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (!hasMoreSessions || loadingMoreSessions) return;

      const container = event.currentTarget;
      const threshold = 120;
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - threshold) {
        void loadMoreSessions();
      }
    },
    [hasMoreSessions, loadMoreSessions, loadingMoreSessions],
  );

  useSidebarContent(null, { width: 0 });

  const handleSubmit = () => {
    const trimmed = draftMessage.trim();
    if (!trimmed) return;

    setDraftMessage('');
    router.push(`/chat?prompt=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="relative min-h-screen">
      <div className="px-4 pb-40 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
          <header className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-[0_18px_35px_rgba(79,70,229,0.35)]">
                  <Brain className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100">Course Architect</p>
                  <p className="text-xs text-slate-500">AI Learning Platform</p>
                </div>
              </div>
              <Button
                type="button"
                onClick={handleSignOut}
                variant="ghost"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </Button>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <h1 className="text-3xl font-semibold text-slate-50">Learning Dashboard</h1>
              <p className="text-sm text-slate-400">
                Track every personalised course you&apos;ve generated with Course Architect.
              </p>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-2">
            <Card className="border-white/10 bg-white/[0.04] p-6 text-slate-100">
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total courses</p>
                  <p className="text-2xl font-semibold text-slate-50">{stats.total}</p>
                </div>
              </div>
            </Card>
          </section>

          <section className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">Your courses</h2>
              <p className="text-sm text-slate-400">
                Revisit a course to continue where you left off.
              </p>
            </div>
            <div className="h-10" />
          </section>

          {allCourses.length === 0 ? (
            <Card className="border-white/10 bg-white/[0.04] p-16 text-center text-slate-300">
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-white/[0.06] text-slate-400">
                <BookOpen className="h-7 w-7" />
              </div>
              <p className="mb-3 text-lg font-medium text-slate-100">No courses yet</p>
              <p className="text-sm text-slate-400">
                Generate your first personalised course to see it appear here.
              </p>
              <Button
                onClick={() => router.push('/chat')}
                variant="outline"
                className="mt-6 border-white/20 bg-white/[0.02] text-slate-100 hover:!bg-white/10 hover:!text-slate-100"
              >
                Start building
              </Button>
            </Card>
          ) : (
            <div className="space-y-6">
              <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {allCourses.map((course) => (
                  <Card
                    key={course.id}
                    className="border-white/10 bg-white/[0.04] p-6 text-slate-100 transition hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <div className="mb-4">
                      <div>
                        <h3 className="text-base font-semibold text-slate-50">
                          {course.topic}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {new Date(course.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleOpenCourse(course)}
                      variant="outline"
                      className="mt-6 w-full border-white/20 bg-white/[0.02] text-slate-100 hover:!bg-white/10 hover:!text-slate-100"
                    >
                      Open course
                    </Button>
                  </Card>
                ))}
              </section>

              <div className="flex flex-col items-center gap-2">
                {courseLoadError ? (
                  <div className="flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-100">
                    <span>{courseLoadError}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-full border border-rose-100/20 bg-transparent px-3 text-xs font-medium text-rose-100 hover:bg-rose-500/20"
                      onClick={() => {
                        void loadMoreCourses();
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                ) : null}

                {hasMoreCourses ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-full border-white/20 bg-white/[0.02] px-4 text-sm font-medium text-slate-100 hover:!bg-white/10 hover:!text-slate-100"
                    onClick={() => {
                      void loadMoreCourses();
                    }}
                    disabled={loadingMoreCourses}
                  >
                    {loadingMoreCourses ? 'Loading…' : 'Load more courses'}
                  </Button>
                ) : (
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    All courses loaded.
                  </p>
                )}
              </div>
            </div>
          )}

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">Recent chats</h2>
                <p className="text-sm text-slate-400">
                  Jump back into a conversation to keep refining your plan.
                </p>
              </div>
              {generatedSessions.length > 0 ? (
                <Button
                  variant="outline"
                  className="h-10 border-white/20 bg-white/[0.02] px-4 text-sm font-medium text-slate-100 hover:!bg-white/10 hover:!text-slate-100"
                  onClick={() => setShowAllSessions((current) => !current)}
                >
                  {showAllSessions ? 'Hide generated' : 'View generated'}
                </Button>
              ) : null}
            </div>

            {sessionsToDisplay.length === 0 ? (
              <Card className="border-white/10 bg-white/[0.04] p-8 text-center text-slate-300">
                {emptySessionsMessage}
              </Card>
            ) : (
              <div
                className="relative max-h-[420px] overflow-y-auto pr-1"
                onScroll={handleSessionsScroll}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  {sessionsToDisplay.map((session) => {
                    const showGeneratedBadge = showAllSessions && session.hasGeneratedCourse;

                    return (
                      <Card
                        key={session.id}
                        className="border-white/10 bg-white/[0.04] p-4 text-slate-100 transition hover:border-white/20 hover:bg-white/[0.06]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-medium text-slate-50">
                                {session.title}
                              </h3>
                              {showGeneratedBadge ? (
                                <Badge className="border-emerald-400/40 bg-emerald-500/15 text-emerald-200">
                                  Generated
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-xs text-slate-500">
                              Updated {new Date(session.updatedAt).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            onClick={() => router.push(`/chat?session=${session.id}`)}
                            variant="outline"
                            className="border-white/20 bg-white/[0.02] text-slate-100 hover:!bg-white/10 hover:!text-slate-100"
                          >
                            Open
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                <div className="flex flex-col items-center gap-2 py-4">
                  {loadingMoreSessions ? (
                    <span className="text-xs text-slate-400">Loading more chats…</span>
                  ) : null}

                  {sessionLoadError ? (
                    <div className="flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-100">
                      <span>{sessionLoadError}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-full border border-rose-100/20 bg-transparent px-3 text-xs font-medium text-rose-100 hover:bg-rose-500/20"
                        onClick={() => {
                          void loadMoreSessions();
                        }}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : null}

                  {hasMoreSessions ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full border-white/20 bg-white/[0.02] px-4 text-xs font-medium text-slate-100 hover:!bg-white/10 hover:!text-slate-100"
                      onClick={() => {
                        void loadMoreSessions();
                      }}
                      disabled={loadingMoreSessions}
                    >
                      {loadingMoreSessions ? 'Loading…' : 'Load more'}
                    </Button>
                  ) : (
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      You&apos;re all caught up.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <div
        className="pointer-events-none fixed bottom-0 right-0 px-4 pb-6 pt-10 sm:px-6 lg:px-8"
        style={{ left: 'max(var(--sidebar-width, 256px), 0px)' }}
      >
        <div className="pointer-events-auto">
          <div className="mx-auto max-w-3xl rounded-full border border-white/10 bg-white/[0.04] p-2 shadow-[0_20px_50px_rgba(15,23,42,0.45)] backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <input
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="What should we learn next?"
                className="flex-1 rounded-full border border-white/10 bg-white/[0.02] px-5 py-4 text-sm text-slate-100 outline-none placeholder:text-slate-400"
              />
              <Button
                onClick={handleSubmit}
                disabled={!draftMessage.trim()}
                size="icon"
                className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.45)] transition hover:shadow-[0_0_45px_rgba(99,102,241,0.6)]"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
