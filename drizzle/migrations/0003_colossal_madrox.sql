ALTER TABLE "course_generation_jobs" ADD COLUMN "processing_by" text;--> statement-breakpoint
ALTER TABLE "course_generation_jobs" ADD COLUMN "last_heartbeat_at" timestamp with time zone;