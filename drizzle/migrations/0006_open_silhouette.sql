ALTER TABLE "course_versions" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "course_versions" ADD COLUMN "share_enabled_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "course_versions_share_token_idx" ON "course_versions" USING btree ("share_token") WHERE "share_token" IS NOT NULL;