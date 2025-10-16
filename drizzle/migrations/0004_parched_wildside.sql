CREATE TABLE "course_generation_snapshots" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"structured_partial" jsonb NOT NULL,
	"module_progress" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_generation_snapshots" ADD CONSTRAINT "course_generation_snapshots_job_id_course_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."course_generation_jobs"("id") ON DELETE cascade ON UPDATE no action;