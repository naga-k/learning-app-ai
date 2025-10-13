export type DashboardCourse = {
  id: string;
  topic: string;
  durationMinutes: number;
  createdAt: string;
  completed: boolean;
  progress: number;
};

/**
 * TODO: Replace with Supabase-backed query for the authenticated user.
 */
export async function listDashboardCourses(): Promise<DashboardCourse[]> {
  const subtractDays = (days: number) =>
    new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  return [
    {
      id: 'mock-1',
      topic: 'Photosynthesis Fundamentals',
      durationMinutes: 15,
      createdAt: subtractDays(3),
      completed: true,
      progress: 100,
    },
    {
      id: 'mock-2',
      topic: 'Machine Learning Basics',
      durationMinutes: 25,
      createdAt: subtractDays(5),
      completed: false,
      progress: 60,
    },
    {
      id: 'mock-3',
      topic: 'Storytelling for Presentations',
      durationMinutes: 20,
      createdAt: subtractDays(7),
      completed: false,
      progress: 35,
    },
  ];
}
