CREATE TABLE "faculty_position_appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "faculty_position_appointment_dates" CHECK ("faculty_position_appointments"."ended_at" >= "faculty_position_appointments"."started_at")
);
--> statement-breakpoint
CREATE TABLE "faculty_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title_en" text NOT NULL,
	"title_ar" text,
	"department_code" text,
	CONSTRAINT "faculty_positions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "faculty_position_appointments" ADD CONSTRAINT "faculty_position_appointments_position_id_faculty_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."faculty_positions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faculty_position_appointments" ADD CONSTRAINT "faculty_position_appointments_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "faculty_position_one_current_holder" ON "faculty_position_appointments" USING btree ("position_id") WHERE "faculty_position_appointments"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "faculty_position_appointment_history" ON "faculty_position_appointments" USING btree ("position_id","started_at");
--> statement-breakpoint
INSERT INTO "faculty_positions" ("code", "title_en", "title_ar", "department_code") VALUES
  ('dean', 'Dean', 'عميد الكلية', null),
  ('vice-dean-administrative-affairs', 'Vice Dean for Administrative Affairs', 'الوكيل الإداري', null),
  ('vice-dean-scientific-affairs', 'Vice Dean for Scientific Affairs', 'الوكيل العلمي', null),
  ('head-administrative-division', 'Head of Administrative Division', 'رئيس الدائرة', null),
  ('head-registry', 'Head of the Registry', 'رئيس الديوان', null),
  ('head-parallel-education', 'Head of Parallel Education', null, null),
  ('head-software-engineering', 'Head of the Software Engineering Department', null, 'software-engineering'),
  ('head-artificial-intelligence', 'Head of the Artificial Intelligence Department', null, 'artificial-intelligence'),
  ('head-network-systems', 'Head of the Network Systems Department', null, 'network-systems'),
  ('head-staff-attendance-monitoring', 'Head of the Staff Attendance and Monitoring Unit', 'رئيس شعبة مراقبة الدوام', null),
  ('head-follow-up-office', 'Head of the Follow-up Office', 'رئيس مكتب المتابعة', null);
