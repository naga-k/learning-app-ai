'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Brain, Send, TrendingUp } from 'lucide-react';
import { DashboardCourse } from '@/lib/dashboard/courses';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

type DashboardViewProps = {
  courses: DashboardCourse[];
};

export function DashboardView({ courses }: DashboardViewProps) {
  const router = useRouter();
  const [draftMessage, setDraftMessage] = useState('');

  const stats = useMemo(() => {
    const total = courses.length;
    const completed = courses.filter((course) => course.completed).length;
    const averageProgress =
      total === 0
        ? 0
        : Math.round(
            courses.reduce((sum, course) => sum + (course.progress ?? 0), 0) / total,
          );

    return {
      total,
      completed,
      averageProgress,
    };
  }, [courses]);

  const handleSubmit = () => {
    const trimmed = draftMessage.trim();
    if (!trimmed) return;

    setDraftMessage('');
    router.push(`/chat?prompt=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="relative min-h-screen w-full px-4 pb-40 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Brain className="h-9 w-9 text-indigo-300" />
            <div>
              <h1 className="text-3xl font-semibold text-slate-50">Learning Dashboard</h1>
              <p className="text-sm text-slate-400">
                Track every personalised course you&apos;ve generated with Course Architect.
              </p>
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

          <Card className="border-white/10 bg-white/[0.04] p-6 text-slate-100">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Completed</p>
                <p className="text-2xl font-semibold text-slate-50">{stats.completed}</p>
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
              className="mt-6 border-white/20 bg-white/[0.02] text-slate-100 hover:bg-white/10"
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
                <div className="mb-4 flex items-start justify-between gap-3">
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

                  {course.completed ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    >
                      ✓ Completed
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-indigo-500/30 bg-indigo-500/10 text-indigo-200"
                    >
                      In progress
                    </Badge>
                  )}
                </div>

                <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
                  <span>{course.durationMinutes} min expected</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>Progress</span>
                    <span className="font-medium text-slate-200">
                      {course.progress ?? 0}%
                    </span>
                  </div>
                  <Progress value={course.progress ?? 0} />
                </div>

                <Button
                  onClick={() => router.push(`/chat?course=${course.id}`)}
                  variant="outline"
                  className="mt-6 w-full border-white/20 bg-white/[0.02] text-slate-100 hover:bg-white/10"
                >
                  Open course
                </Button>
              </Card>
            ))}
          </section>
        )}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 px-4 pb-6 pt-10 sm:px-6 lg:px-8">
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
