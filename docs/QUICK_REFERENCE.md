# Quick Reference Guide

## Worktree Setup

```bash
# Create worktrees for all tasks
git worktree add ../learning-app-ai-engagement-tools feature/engagement-tools
git worktree add ../learning-app-ai-analytics feature/analytics-progress
git worktree add ../learning-app-ai-sharing feature/sharing-collaboration
git worktree add ../learning-app-ai-ai-assistant feature/ai-assistant-enhancements
git worktree add ../learning-app-ai-performance feature/performance-optimization
git worktree add ../learning-app-ai-testing feature/testing-qa
git worktree add ../learning-app-ai-ui feature/ui-ux-enhancements
git worktree add ../learning-app-ai-docs feature/docs-dx

# In each worktree, install dependencies
cd ../learning-app-ai-<task-name> && npm install
```

## Task Overview

| Task | Branch | Focus Area | Key Files |
|------|--------|------------|-----------|
| 1 | `feature/engagement-tools` | Engagement blocks | `lib/ai/tools/`, `components/course/` |
| 2 | `feature/analytics-progress` | Progress tracking | `lib/db/`, `components/dashboard/` |
| 3 | `feature/sharing-collaboration` | Sharing & comments | `app/api/courses/`, `lib/db/` |
| 4 | `feature/ai-assistant-enhancements` | AI improvements | `lib/prompts/`, `lib/ai/` |
| 5 | `feature/performance-optimization` | Performance | `worker/`, `lib/db/`, `app/api/` |
| 6 | `feature/testing-qa` | Testing | All files |
| 7 | `feature/ui-ux-enhancements` | UI/UX | `components/` |
| 8 | `feature/docs-dx` | Documentation | `docs/` |

## Key Directories

- `lib/db/` - Database schema and operations
- `lib/ai/` - AI tools and providers
- `lib/prompts/` - AI prompts
- `components/course/` - Course UI components
- `components/chat/` - Chat UI
- `app/api/` - API routes
- `worker/` - Background worker

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run worker:course    # Start course generator worker

# Database
npm run db:generate      # Generate migrations
npm run db:migrate       # Run migrations

# Testing (after Task 6)
npm test                 # Run tests
npm run test:coverage    # Coverage report
```

## Documentation Files

- `docs/DEVELOPMENT_PLAN.md` - Overall development plan
- `docs/WORKTREE_TASKS.md` - Worktree setup instructions
- `docs/TASK_PROMPTS.md` - All task prompts
- `docs/tasks/task-*.md` - Individual task prompts
- `docs/QUICK_REFERENCE.md` - This file

## Getting Help

1. Review the task-specific prompt in `docs/tasks/task-*.md`
2. Check reference files listed in each task prompt
3. Review existing code patterns in the codebase
4. Consult `docs/DEVELOPMENT_PLAN.md` for system overview

