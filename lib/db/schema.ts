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
import { pgPolicy } from "drizzle-orm/pg-core";
import {
  anonRole,
  authenticatedRole,
  serviceRole,
} from "drizzle-orm/supabase";

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy("chat_sessions_select_own", {
    for: "select",
    to: authenticatedRole,
    using: sql`${table.userId} = auth.uid()`,
  }),
  pgPolicy("chat_sessions_insert_own", {
    for: "insert",
    to: authenticatedRole,
    withCheck: sql`${table.userId} = auth.uid()`,
  }),
  pgPolicy("chat_sessions_update_own", {
    for: "update",
    to: authenticatedRole,
    using: sql`${table.userId} = auth.uid()`,
    withCheck: sql`${table.userId} = auth.uid()`,
  }),
  pgPolicy("chat_sessions_delete_own", {
    for: "delete",
    to: authenticatedRole,
    using: sql`${table.userId} = auth.uid()`,
  }),
  pgPolicy("chat_sessions_service_all", {
    for: "all",
    to: serviceRole,
    using: sql`true`,
    withCheck: sql`true`,
  }),
]).enableRLS();

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull(),
  role: text("role").notNull(),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy("chat_messages_select_session_owner", {
    for: "select",
    to: authenticatedRole,
    using: sql`exists (
      select 1 from chat_sessions cs
      where cs.id = ${table.sessionId} and cs.user_id = auth.uid()
    )`,
  }),
  pgPolicy("chat_messages_insert_session_owner", {
    for: "insert",
    to: authenticatedRole,
    withCheck: sql`exists (
      select 1 from chat_sessions cs
      where cs.id = ${table.sessionId} and cs.user_id = auth.uid()
    )`,
  }),
  pgPolicy("chat_messages_update_session_owner", {
    for: "update",
    to: authenticatedRole,
    using: sql`exists (
      select 1 from chat_sessions cs
      where cs.id = ${table.sessionId} and cs.user_id = auth.uid()
    )`,
    withCheck: sql`exists (
      select 1 from chat_sessions cs
      where cs.id = ${table.sessionId} and cs.user_id = auth.uid()
    )`,
  }),
  pgPolicy("chat_messages_delete_session_owner", {
    for: "delete",
    to: authenticatedRole,
    using: sql`exists (
      select 1 from chat_sessions cs
      where cs.id = ${table.sessionId} and cs.user_id = auth.uid()
    )`,
  }),
  pgPolicy("chat_messages_service_all", {
    for: "all",
    to: serviceRole,
    using: sql`true`,
    withCheck: sql`true`,
  }),
]).enableRLS();

export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  sessionId: uuid("session_id"),
  title: text("title").notNull(),
  activeVersionId: uuid("active_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy("courses_select_own", {
    for: "select",
    to: authenticatedRole,
    using: sql`${table.userId} = auth.uid()`,
  }),
  pgPolicy("courses_insert_own", {
    for: "insert",
    to: authenticatedRole,
    withCheck: sql`${table.userId} = auth.uid()`,
  }),
  pgPolicy("courses_update_own", {
    for: "update",
    to: authenticatedRole,
    using: sql`${table.userId} = auth.uid()`,
    withCheck: sql`${table.userId} = auth.uid()`,
  }),
  pgPolicy("courses_delete_own", {
    for: "delete",
    to: authenticatedRole,
    using: sql`${table.userId} = auth.uid()`,
  }),
  pgPolicy("courses_service_all", {
    for: "all",
    to: serviceRole,
    using: sql`true`,
    withCheck: sql`true`,
  }),
]).enableRLS();

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
}), (table) => [
  pgPolicy("course_versions_select_owner", {
    for: "select",
    to: authenticatedRole,
    using: sql`exists (
      select 1 from courses c
      where c.id = ${table.courseId} and c.user_id = auth.uid()
    )`,
  }),
  pgPolicy("course_versions_insert_owner", {
    for: "insert",
    to: authenticatedRole,
    withCheck: sql`exists (
      select 1 from courses c
      where c.id = ${table.courseId} and c.user_id = auth.uid()
    )`,
  }),
  pgPolicy("course_versions_update_owner", {
    for: "update",
    to: authenticatedRole,
    using: sql`exists (
      select 1 from courses c
      where c.id = ${table.courseId} and c.user_id = auth.uid()
    )`,
    withCheck: sql`exists (
      select 1 from courses c
      where c.id = ${table.courseId} and c.user_id = auth.uid()
    )`,
  }),
  pgPolicy("course_versions_delete_owner", {
    for: "delete",
    to: authenticatedRole,
    using: sql`exists (
      select 1 from courses c
      where c.id = ${table.courseId} and c.user_id = auth.uid()
    )`,
  }),
  pgPolicy("course_versions_select_shared", {
    for: "select",
    to: anonRole,
    using: sql`${table.shareEnabledAt} is not null and ${table.shareToken} is not null`,
  }),
  pgPolicy("course_versions_service_all", {
    for: "all",
    to: serviceRole,
    using: sql`true`,
    withCheck: sql`true`,
  }),
]).enableRLS();

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
}, (table) => [
  pgPolicy("course_generation_jobs_select_owner", {
    for: "select",
    to: authenticatedRole,
    using: sql`${table.userId} = auth.uid()`,
  }),
  pgPolicy("course_generation_jobs_insert_owner", {
    for: "insert",
    to: authenticatedRole,
    withCheck: sql`${table.userId} = auth.uid()`,
  }),
  pgPolicy("course_generation_jobs_service_all", {
    for: "all",
    to: serviceRole,
    using: sql`true`,
    withCheck: sql`true`,
  }),
]).enableRLS();

export const courseGenerationSnapshots = pgTable("course_generation_snapshots", {
  jobId: uuid("job_id")
    .primaryKey()
    .references(() => courseGenerationJobs.id, { onDelete: "cascade" }),
  structuredPartial: jsonb("structured_partial").notNull(),
  moduleProgress: jsonb("module_progress"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy("course_generation_snapshots_select_owner", {
    for: "select",
    to: authenticatedRole,
    using: sql`exists (
      select 1 from course_generation_jobs j
      where j.id = ${table.jobId} and j.user_id = auth.uid()
    )`,
  }),
  pgPolicy("course_generation_snapshots_service_all", {
    for: "all",
    to: serviceRole,
    using: sql`true`,
    withCheck: sql`true`,
  }),
]).enableRLS();

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
  }), (table) => [
    pgPolicy("course_engagement_blocks_select_owner", {
      for: "select",
      to: authenticatedRole,
      using: sql`exists (
        select 1
        from course_versions v
        join courses c on c.id = v.course_id
        where v.id = ${table.courseVersionId}
        and c.user_id = auth.uid()
      )`,
    }),
    pgPolicy("course_engagement_blocks_select_shared", {
      for: "select",
      to: anonRole,
      using: sql`exists (
        select 1
        from course_versions v
        where v.id = ${table.courseVersionId}
          and v.share_enabled_at is not null
          and v.share_token is not null
      )`,
    }),
    pgPolicy("course_engagement_blocks_service_all", {
      for: "all",
      to: serviceRole,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();

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
  }), (table) => [
    pgPolicy("course_engagement_responses_select_owner", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = auth.uid()`,
    }),
    pgPolicy("course_engagement_responses_insert_owner", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = auth.uid()`,
    }),
    pgPolicy("course_engagement_responses_update_owner", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.userId} = auth.uid()`,
      withCheck: sql`${table.userId} = auth.uid()`,
    }),
    pgPolicy("course_engagement_responses_delete_owner", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = auth.uid()`,
    }),
    pgPolicy("course_engagement_responses_service_all", {
      for: "all",
      to: serviceRole,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();
