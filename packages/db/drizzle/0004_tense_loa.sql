CREATE TABLE "hr_request_workflow_steps" (
	"workflow_step_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_type_id" uuid NOT NULL,
	"step_order" smallint NOT NULL,
	"name" text NOT NULL,
	"reviewer_role_id" text,
	"is_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_request_workflow_steps_type_order_unique" UNIQUE("request_type_id","step_order")
);
--> statement-breakpoint
ALTER TABLE "hr_documents" RENAME COLUMN "created_at" TO "uploaded_at";--> statement-breakpoint
DROP INDEX "hr_employment_records_current_idx";--> statement-breakpoint
ALTER TABLE "hr_audit_log" ALTER COLUMN "previous_values" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "hr_audit_log" ALTER COLUMN "new_values" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD COLUMN "sha256" text;--> statement-breakpoint
ALTER TABLE "hr_employment_records" ADD COLUMN "employment_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "hr_request_workflow_steps" ADD CONSTRAINT "hr_request_workflow_steps_request_type_id_hr_request_types_request_type_id_fk" FOREIGN KEY ("request_type_id") REFERENCES "public"."hr_request_types"("request_type_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_workflow_steps" ADD CONSTRAINT "hr_request_workflow_steps_reviewer_role_id_roles_id_fk" FOREIGN KEY ("reviewer_role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hr_employment_records_current_idx" ON "hr_employment_records" USING btree ("employee_id") WHERE "hr_employment_records"."is_current" = 1;--> statement-breakpoint
ALTER TABLE "hr_employees" DROP COLUMN "department";--> statement-breakpoint
ALTER TABLE "hr_employees" DROP COLUMN "employment_status";--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_exactly_one_owner_check" CHECK (num_nonnulls("hr_documents"."employee_id", "hr_documents"."employment_record_id", "hr_documents"."certificate_id", "hr_documents"."decision_id") = 1);