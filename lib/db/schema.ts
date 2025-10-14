import { pgTable, text, timestamp, uuid, jsonb, integer } from "drizzle-orm/pg-core";

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
  durationMinutes: integer("duration_minutes"),
  progress: integer("progress").default(0).notNull(),
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
