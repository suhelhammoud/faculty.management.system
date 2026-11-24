ALTER TABLE "curriculum_modules" ALTER COLUMN "credits" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "curriculum_modules" ALTER COLUMN "credits" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "curriculum_modules" ADD COLUMN "name_ar" text;--> statement-breakpoint
ALTER TABLE "curriculum_modules" ADD COLUMN "theory_marks" smallint;--> statement-breakpoint
ALTER TABLE "curriculum_modules" ADD COLUMN "practical_marks" smallint;--> statement-breakpoint
ALTER TABLE "curriculum_modules" ADD COLUMN "total_marks" smallint;--> statement-breakpoint
ALTER TABLE "curriculum_modules" ADD COLUMN "progress_marks" smallint;--> statement-breakpoint
ALTER TABLE "curriculum_modules" ADD CONSTRAINT "curriculum_module_marks_check" CHECK ("curriculum_modules"."theory_marks" between 0 and 100 and "curriculum_modules"."practical_marks" between 0 and 100
        and "curriculum_modules"."total_marks" between 0 and 100 and "curriculum_modules"."progress_marks" between 0 and 100);