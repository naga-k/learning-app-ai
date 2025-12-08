export const DASHBOARD_SESSIONS_PAGE_SIZE = 12;
export const DASHBOARD_COURSES_PAGE_SIZE = 9;

// Feature flags are environment-driven to keep rollout lightweight.
// Defaults keep the new surfaces on unless explicitly disabled.
export const ENABLE_GAMIFIED_COURSE = process.env.NEXT_PUBLIC_ENABLE_GAMIFY !== 'false';
export const ENABLE_COURSE_COPILOT = process.env.NEXT_PUBLIC_ENABLE_COPILOT !== 'false';
export const ENABLE_QUICK_CHECKS =
  process.env.NEXT_PUBLIC_ENABLE_QUICK_CHECKS !== 'false';
