import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull(),
  role: text("role").notNull(),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  sessionId: uuid("session_id"),
  title: text("title").notNull(),
  activeVersionId: uuid("active_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const courseVersions = pgTable("course_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id").notNull(),
  summary: text("summary"),
  structured: jsonb("structured").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  shareToken: text("share_token"),
  shareEnabledAt: timestamp("share_enabled_at", { withTimezone: true }),
}, (table) => ({
  shareTokenUnique: uniqueIndex("course_versions_share_token_idx")
    .on(table.shareToken)
    .where(sql`"share_token" IS NOT NULL`),
}));

export const courseProgress = pgTable(
  "course_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    courseVersionId: uuid("course_version_id")
      .notNull()
      .references(() => courseVersions.id, { onDelete: "cascade" }),
    submoduleId: text("submodule_id").notNull(),
    status: text("status").notNull().default("not_started"),
    timeSpentSeconds: integer("time_spent_seconds").default(0),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserSubmodule: uniqueIndex("course_progress_user_submodule_idx").on(
      table.userId,
      table.courseVersionId,
      table.submoduleId,
    ),
    userCourseIdx: index("course_progress_user_course_idx").on(
      table.userId,
      table.courseId,
    ),
    courseVersionIdx: index("course_progress_course_version_idx").on(
      table.courseVersionId,
    ),
  }),
);

export const courseGenerationJobs = pgTable("course_generation_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  sessionId: uuid("session_id").notNull(),
  assistantMessageId: uuid("assistant_message_id"),
  queueJobId: text("queue_job_id"),
  processingBy: text("processing_by"),
  status: text("status").notNull().default("queued"),
  error: text("error"),
  payload: jsonb("payload"),
  resultSummary: text("result_summary"),
  resultCourseId: uuid("result_course_id"),
  resultCourseVersionId: uuid("result_course_version_id"),
  resultCourseStructured: jsonb("result_course_structured"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const courseGenerationSnapshots = pgTable("course_generation_snapshots", {
  jobId: uuid("job_id")
    .primaryKey()
    .references(() => courseGenerationJobs.id, { onDelete: "cascade" }),
  structuredPartial: jsonb("structured_partial").notNull(),
  moduleProgress: jsonb("module_progress"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const courseEngagementBlocks = pgTable(
  "course_engagement_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseVersionId: uuid("course_version_id")
      .notNull()
      .references(() => courseVersions.id, { onDelete: "cascade" }),
    submoduleId: text("submodule_id").notNull(),
    blockId: text("block_id").notNull(),
    blockType: text("block_type").notNull(),
    blockOrder: integer("block_order").notNull(),
    blockRevision: integer("block_revision").notNull(),
    contentHash: text("content_hash").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    courseVersionBlockIdIndex: uniqueIndex("course_engagement_blocks_version_block_idx").on(
      table.courseVersionId,
      table.blockId,
    ),
    courseVersionOrderIndex: index("course_engagement_blocks_order_idx").on(
      table.courseVersionId,
      table.blockOrder,
    ),
  }),
);

export const courseEngagementResponses = pgTable(
  "course_engagement_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    courseVersionId: uuid("course_version_id")
      .notNull()
      .references(() => courseVersions.id, { onDelete: "cascade" }),
    submoduleId: text("submodule_id").notNull(),
    blockId: text("block_id").notNull(),
    blockType: text("block_type").notNull(),
    blockRevision: integer("block_revision").notNull(),
    contentHash: text("content_hash").notNull(),
    response: jsonb("response").notNull(),
    score: integer("score"),
    isCorrect: boolean("is_correct"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniquePerBlock: uniqueIndex("course_engagement_responses_unique").on(
      table.userId,
      table.courseVersionId,
      table.blockId,
    ),
    versionBlockLookup: index("course_engagement_responses_version_block_idx").on(
      table.courseVersionId,
      table.blockId,
    ),
  }),
);
