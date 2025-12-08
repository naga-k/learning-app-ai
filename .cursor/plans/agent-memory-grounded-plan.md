---
name: agent-memory-copilot-consolidated
overview: End-to-end plan combining persistent memory, grounded course generation, NotebookLM-style copilot, and gamified progression with quality-focused micro-checks.
---

# Agent Memory + Grounded Copilot + Gamification (Consolidated)

## Goals
- Deliver a contextual copilot grounded in lesson/module content and user selections, with quick actions and citations.
- Add durable memory (self-hosted first) to retain learner/session context and power retrieval-backed generation.
- Make progress meaningful: transparent points/streaks/badges with clear rules and server-side durability.
- Upgrade course generation to a checkpointed, validated pipeline with retrieval, citations, and regen controls.
- Ship safely with feature flags, observability, and regression/eval hooks.

## Current state (repo)
- Plan-first flow; course generation runs in worker (`worker/course-generator.ts`) using prompts in `lib/prompts/course.ts`.
- Persistence: Supabase/Postgres tables for courses, chat sessions/messages, engagement blocks/responses (`lib/db/schema.ts`). No vector/memory store yet.
- Engagement generated inline; partial snapshots exist; minimal UX controls and flags.

## Experience pillars (NotebookLM + Research 3)
- Context-perfect copilot: auto-grounded to lesson/module text + selection window; semantic trimming; inline citations back to sources.
- Meaningful progression: points, % complete, streak, badges with explainable rules (first lesson, 3-day streak, module mastery, no-hint clear).
- Teaching micro-checks: cached per-submodule, rationale + “teach-back” hint when wrong; lightweight rubric or semantic scoring for free text.
- Notebook-style grounding: treat course/session as a notebook with attached sources (lesson text, uploads, URLs, prior chats); Q&A and summaries cite sources; refresh embeddings on updates.

## NotebookLM behaviors to emulate (public cues)
- Notebook-centric retrieval: scope answers to the active notebook; include citations to attached sources.
- AI Notes-style summaries: multi-source summaries with “focus” prompts (e.g., summarize for a beginner, extract action items, compare two sections).
- Contextual Q&A: copilot responses cite specific notebook items; uncited claims are rejected or re-asked.
- Selection-aware: adjust grounding to the highlighted section/lesson slice; semantic slicing instead of naive truncation.
- Refresh/versioning: when sources change, re-embed and keep versioned snapshots so conversations/generation can replay with stable contexts.
- Stretch (future): multimodal readiness for audio; today ship text-first with compatible data structures.
- Inline cite-and-link UX: show numbered citations inline; clicking opens the source snippet within the notebook context.
- Note collections: allow users to pin/save AI notes (summaries, extracts, follow-ups) per notebook/course for later recall.
- Compare/contrast prompts: support side-by-side summarization of two sections or sources within the same notebook.
- “Focus on” controls: user-selectable lenses (beginner, exec, practitioner, critical gaps, action items) applied to summaries/answers.
- Source filtering: let users include/exclude specific sources (e.g., lesson vs. uploaded PDF) before answering.

## Architecture choices
- Memory store: default to Supabase Postgres + `pgvector`; keep adapter interface for LanceDB local-first or Qdrant at scale.
- Retrieval: semantic slices per lesson/module + attached sources; include source IDs for citations; cache embeddings and recent slices per job.
- Models: reasoning model for planning/critique (low temperature); faster model for drafting; optional higher-quality pass for critique.
- Flags: `ENABLE_GAMIFY`, `ENABLE_COPILOT`, `ENABLE_QUICK_CHECKS`, `ENABLE_RETRIEVAL_PIPELINE` default off for rollout.
- Telemetry: optional `course_events` table (event_type, course_version_id, submodule_id, user_id, payload JSON, created_at) for durable analytics; client events for copilot/checks/badges.

## Phases and workstreams

### Phase 1 — Foundations & Contracts
- Add feature flags in config (`lib/dashboard/config.ts`) and envs.
- Document schemas/contracts for plan, course, lesson, engagement in one place (`lib/prompts/course.ts` or `lib/curriculum`).
- Add progress UI placeholder for generation status; graceful fallback text when blocks are pending.

### Phase 2 — Durable Memory Layer
- Introduce memory schema (per user/course/session) with embeddings + metadata (source, freshness, confidence) in Postgres/pgvector.
- Build ingestion/update utilities in `lib/ai`/`lib/chat`; support lesson text, user uploads/URLs, prior chats.
- Add read path for copilot/course generation to fetch top-K scoped to active course/session; cache recent context.

### Phase 3 — Checkpointed Course Generation
- Refactor worker into checkpoints: outline → lesson drafts → engagement blocks → conclusion; persist snapshots per stage and allow resume/replay.
- Upgrade prompts to accept learner profile/intake, budgets (time, module count), level/tone knobs, compliance flags, and citation requirements.
- Add targeted regen endpoints for single lesson/engagement block; keep existing flow as fallback when flags are off.

### Phase 4 — Retrieval + Validation
- Wire retrieval over notebook-scoped sources (vector + optional doc store); add semantic trimming to keep tokens bounded.
- Enforce citations: prompt must return sources; reject uncited claims; gate resources (https-only, dedupe, max 3, credibility tag).
- Validators: budget adherence, module/submodule counts, required sections non-empty, engagement count per lesson.

### Phase 5 — Copilot Rail & UX Controls
- Copilot rail in course workspace with quick actions: summarize, hint, practice question, adaptive follow-up based on last miss; ground on lesson/module + selection.
- Add UI levers: level, tone, time budget, domain focus, format preference, compliance mode; expose pre-generation and in per-lesson regen.
- Progress header: points, % complete, streak, key badges; computed from engagement responses + lesson completions.

### Phase 6 — Micro-Checks & Feedback
- Generate/cache per-submodule checks (during course generation or first request); avoid per-request regen.
- Feedback: include rationale + “if wrong, try this next” hint; short-answer scoring via rubric or hybrid keyword/semantic.
- Persist attempts in engagement responses; local cache for anon users; show status/retry and explain feedback.

### Phase 7 — Badges, Streaks, Logging
- Implement explicit badge rules: first lesson, 3-day streak (timezone-tolerant), module mastery (all blocks correct), no-hint clear.
- Streak stored server-side when authenticated; client fallback when not.
- Log unlocks and copilot/check events to `course_events` (optional) plus client analytics; add lightweight operator review view (optional).

### Phase 8 — Observability, Eval, Rollout
- Tracing per generation stage (prompt, inputs, outputs, durations, model, flag state); LangSmith/OpenTelemetry-compatible hooks.
- Feedback loop: “good/needs work” with tags (too long, off-level, ungrounded, generic feedback) stored per lesson.
- Regression harness for canned conversations and generation outputs; metrics: JSON validity, latency, groundedness/citation coverage, policy violation rate, copilot CSAT, re-ask rate, quick-check pass-after-hint, streak continuation.
- Rollout: internal testers → small % → general; monitor costs/latency per stage; defaults on once validated.

## Implementation notes
- Keep additive: existing markdown-only flow remains when flags off.
- Semantic slicing: prefer structured slicing by headings/selection, then embedding-based rerank to keep context tight.
- Context freshness: re-embed when lesson/source updates; version snapshots so generation can replay with stable contexts.
- Determinism: low temperature on critique and quick actions; optional web search only when lesson context insufficient.

## Risks & mitigations
- Token bloat: mitigate with semantic trimming and cached slices/checks.
- Uncited answers: enforce validator to block or downgrade responses without sources.
- Streak/badge integrity: server-side storage for authenticated users; explicit rules visible to users.
- Latency: cache checks and embeddings; use staged pipeline with partial streaming.
