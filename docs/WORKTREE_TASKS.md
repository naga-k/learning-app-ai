# Worktree Development Tasks

This document contains detailed prompts for coding agents working on parallel tasks via git worktrees.

## Setup Instructions

1. Create worktrees for each task:
```bash
git worktree add ../learning-app-ai-engagement-tools feature/engagement-tools
git worktree add ../learning-app-ai-analytics feature/analytics-progress
git worktree add ../learning-app-ai-sharing feature/sharing-collaboration
git worktree add ../learning-app-ai-ai-assistant feature/ai-assistant-enhancements
git worktree add ../learning-app-ai-performance feature/performance-optimization
git worktree add ../learning-app-ai-testing feature/testing-qa
git worktree add ../learning-app-ai-ui feature/ui-ux-enhancements
git worktree add ../learning-app-ai-docs feature/docs-dx
```

2. Each worktree is independent - install dependencies in each:
```bash
cd ../learning-app-ai-engagement-tools && npm install
```

3. Reference the main branch for shared code:
```bash
git fetch origin dev
```

