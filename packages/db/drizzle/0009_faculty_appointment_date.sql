ALTER TABLE "faculty_position_appointments" ADD COLUMN "appointment_date" date;
--> statement-breakpoint
UPDATE "faculty_position_appointments"
SET "appointment_date" = ("started_at" AT TIME ZONE 'UTC')::date;
--> statement-breakpoint
ALTER TABLE "faculty_position_appointments" ALTER COLUMN "appointment_date" SET NOT NULL;
