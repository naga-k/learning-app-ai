ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chat_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "course_engagement_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "course_engagement_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "course_generation_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "course_generation_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "course_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chat_messages_select_session_owner" ON "chat_messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
      select 1 from chat_sessions cs
      where cs.id = "chat_messages"."session_id" and cs.user_id = auth.uid()
    ));--> statement-breakpoint
CREATE POLICY "chat_messages_insert_session_owner" ON "chat_messages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (
      select 1 from chat_sessions cs
      where cs.id = "chat_messages"."session_id" and cs.user_id = auth.uid()
    ));--> statement-breakpoint
CREATE POLICY "chat_messages_update_session_owner" ON "chat_messages" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (
      select 1 from chat_sessions cs
      where cs.id = "chat_messages"."session_id" and cs.user_id = auth.uid()
    )) WITH CHECK (exists (
      select 1 from chat_sessions cs
      where cs.id = "chat_messages"."session_id" and cs.user_id = auth.uid()
    ));--> statement-breakpoint
CREATE POLICY "chat_messages_delete_session_owner" ON "chat_messages" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (
      select 1 from chat_sessions cs
      where cs.id = "chat_messages"."session_id" and cs.user_id = auth.uid()
    ));--> statement-breakpoint
CREATE POLICY "chat_messages_service_all" ON "chat_messages" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "chat_sessions_select_own" ON "chat_sessions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("chat_sessions"."user_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "chat_sessions_insert_own" ON "chat_sessions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("chat_sessions"."user_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "chat_sessions_update_own" ON "chat_sessions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("chat_sessions"."user_id" = auth.uid()) WITH CHECK ("chat_sessions"."user_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "chat_sessions_delete_own" ON "chat_sessions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("chat_sessions"."user_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "chat_sessions_service_all" ON "chat_sessions" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "course_generation_jobs_select_owner" ON "course_generation_jobs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("course_generation_jobs"."user_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "course_generation_jobs_insert_owner" ON "course_generation_jobs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("course_generation_jobs"."user_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "course_generation_jobs_service_all" ON "course_generation_jobs" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "course_generation_snapshots_select_owner" ON "course_generation_snapshots" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (
      select 1 from course_generation_jobs j
      where j.id = "course_generation_snapshots"."job_id" and j.user_id = auth.uid()
    ));--> statement-breakpoint
CREATE POLICY "course_generation_snapshots_service_all" ON "course_generation_snapshots" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "courses_select_own" ON "courses" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("courses"."user_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "courses_insert_own" ON "courses" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("courses"."user_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "courses_update_own" ON "courses" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("courses"."user_id" = auth.uid()) WITH CHECK ("courses"."user_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "courses_delete_own" ON "courses" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("courses"."user_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "courses_service_all" ON "courses" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);