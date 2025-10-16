CREATE TABLE "course_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"assistant_message_id" uuid,
	"queue_job_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"payload" jsonb,
	"result_summary" text,
	"result_course_id" uuid,
	"result_course_version_id" uuid,
	"result_course_structured" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
