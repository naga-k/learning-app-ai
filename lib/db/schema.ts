import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

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
});

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
