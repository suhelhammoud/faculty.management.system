CREATE TABLE "student_affairs_promotion_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"issued_by" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_by" text,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "student_affairs_promotion_grant_time_check" CHECK ("student_affairs_promotion_grants"."expires_at" > "student_affairs_promotion_grants"."issued_at")
);
--> statement-breakpoint
CREATE TABLE "student_affairs_staff_years" (
	"user_id" text NOT NULL,
	"study_year" smallint NOT NULL,
	CONSTRAINT "student_affairs_staff_years_user_id_study_year_pk" PRIMARY KEY("user_id","study_year"),
	CONSTRAINT "student_affairs_staff_year_check" CHECK ("student_affairs_staff_years"."study_year" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "father_name" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "current_study_year" smallint;--> statement-breakpoint
ALTER TABLE "student_affairs_promotion_grants" ADD CONSTRAINT "student_affairs_promotion_grants_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_affairs_staff_years" ADD CONSTRAINT "student_affairs_staff_years_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_affairs_promotion_grants_recipient_idx" ON "student_affairs_promotion_grants" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "students_current_study_year_idx" ON "students" USING btree ("current_study_year");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_current_study_year_check" CHECK ("students"."current_study_year" between 1 and 5);