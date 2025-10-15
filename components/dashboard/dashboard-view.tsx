'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Brain, Send } from 'lucide-react';
import { DashboardCourse } from '@/lib/dashboard/courses';
import { DashboardSession } from '@/lib/dashboard/sessions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type DashboardViewProps = {
  courses: DashboardCourse[];
  sessions: DashboardSession[];
};

export function DashboardView({ courses, sessions }: DashboardViewProps) {
  const router = useRouter();
  const [draftMessage, setDraftMessage] = useState('');
  const [showAllSessions, setShowAllSessions] = useState(false);

  const { activeSessions, generatedSessions } = useMemo(() => {
    const active: DashboardSession[] = [];
    const generated: DashboardSession[] = [];

    sessions.forEach((session) => {
      if (session.hasGeneratedCourse) {
        generated.push(session);
      } else {
        active.push(session);
      }
    });

    return { activeSessions: active, generatedSessions: generated };
  }, [sessions]);

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
      total: courses.length,
    }),
    [courses],
  );

  const sessionsToDisplay = showAllSessions ? sessions : activeSessions;

  const emptySessionsMessage =
    sessions.length === 0
      ? 'No conversations yet. Start chatting to see sessions here.'
      : 'All recent chats have generated courses. Use View generated to revisit them.';

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
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Brain className="h-9 w-9 text-indigo-300" />
                <div>
                  <h1 className="text-3xl font-semibold text-slate-50">Learning Dashboard</h1>
                  <p className="text-sm text-slate-400">
                    Track every personalised course you&apos;ve generated with Course Architect.
                  </p>
                </div>
              </div>
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

          {courses.length === 0 ? (
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
            <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {courses.map((course) => (
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
