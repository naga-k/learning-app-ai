CREATE TABLE "course_engagement_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_version_id" uuid NOT NULL,
	"submodule_id" text NOT NULL,
	"block_id" text NOT NULL,
	"block_type" text NOT NULL,
	"block_order" integer NOT NULL,
	"block_revision" integer NOT NULL,
	"content_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_engagement_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"course_version_id" uuid NOT NULL,
	"submodule_id" text NOT NULL,
	"block_id" text NOT NULL,
	"block_type" text NOT NULL,
	"block_revision" integer NOT NULL,
	"content_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"score" integer,
	"is_correct" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_engagement_blocks" ADD CONSTRAINT "course_engagement_blocks_course_version_id_course_versions_id_fk" FOREIGN KEY ("course_version_id") REFERENCES "public"."course_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_engagement_responses" ADD CONSTRAINT "course_engagement_responses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_engagement_responses" ADD CONSTRAINT "course_engagement_responses_course_version_id_course_versions_id_fk" FOREIGN KEY ("course_version_id") REFERENCES "public"."course_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_engagement_blocks_version_block_idx" ON "course_engagement_blocks" USING btree ("course_version_id","block_id");--> statement-breakpoint
CREATE INDEX "course_engagement_blocks_order_idx" ON "course_engagement_blocks" USING btree ("course_version_id","block_order");--> statement-breakpoint
CREATE UNIQUE INDEX "course_engagement_responses_unique" ON "course_engagement_responses" USING btree ("user_id","course_version_id","block_id");--> statement-breakpoint
CREATE INDEX "course_engagement_responses_version_block_idx" ON "course_engagement_responses" USING btree ("course_version_id","block_id");