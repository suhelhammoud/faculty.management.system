ALTER TABLE "students" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_revision_check" CHECK ("students"."revision" > 0);