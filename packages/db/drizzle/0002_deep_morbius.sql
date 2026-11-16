CREATE TABLE "hr_academic_ranks" (
	"rank_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"rank_order" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_academic_ranks_code_unique" UNIQUE("code"),
	CONSTRAINT "hr_academic_ranks_order_unique" UNIQUE("rank_order")
);
--> statement-breakpoint
CREATE TABLE "hr_administrative_decisions" (
	"decision_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"decision_number" text NOT NULL,
	"decision_type" text NOT NULL,
	"decision_date" date NOT NULL,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_audit_log" (
	"audit_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"previous_values" text,
	"new_values" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_documents" (
	"document_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid,
	"employment_record_id" uuid,
	"certificate_id" uuid,
	"decision_id" uuid,
	"storage_key" text NOT NULL,
	"original_file_name" text NOT NULL,
	"mime_type" text,
	"byte_size" integer,
	"description" text,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_employee_certificates" (
	"certificate_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"qualification" text NOT NULL,
	"field_of_study" text,
	"institution" text NOT NULL,
	"country" text,
	"award_date" date,
	"equivalency_decision" text,
	"is_appointment_basis" smallint DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_employees" (
	"employee_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_number" text NOT NULL,
	"user_id" text,
	"first_name_ar" text NOT NULL,
	"middle_name_ar" text,
	"last_name_ar" text NOT NULL,
	"first_name_en" text,
	"middle_name_en" text,
	"last_name_en" text,
	"birth_date" date,
	"nationality" text,
	"civil_registry_number" text,
	"phone_number" text,
	"mobile_number" text,
	"email" text,
	"address" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"department" text,
	"employment_status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_employees_employee_number_unique" UNIQUE("employee_number"),
	CONSTRAINT "hr_employees_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "hr_employment_grades" (
	"grade_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_id" uuid NOT NULL,
	"grade_number" smallint NOT NULL,
	"step_number" smallint,
	"label_ar" text,
	"label_en" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_employment_grades_scheme_grade_step_unique" UNIQUE("scheme_id","grade_number","step_number")
);
--> statement-breakpoint
CREATE TABLE "hr_employment_records" (
	"employment_record_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"academic_rank_id" uuid,
	"grade_id" uuid,
	"department" text,
	"employment_regime" text NOT NULL,
	"appointment_type" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"decision_number" text,
	"decision_date" date,
	"is_current" smallint DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_grade_schemes" (
	"scheme_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_grade_schemes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "hr_positions" (
	"position_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"is_academic" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_positions_category_code_unique" UNIQUE("category_id","code")
);
--> statement-breakpoint
CREATE TABLE "hr_staff_categories" (
	"category_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_staff_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "hr_request_reviews" (
	"review_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"reviewer_id" text,
	"stage" text NOT NULL,
	"outcome" text NOT NULL,
	"comments" text,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_request_types" (
	"request_type_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_request_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "hr_requests" (
	"request_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_number" text NOT NULL,
	"employee_id" uuid NOT NULL,
	"request_type_id" uuid NOT NULL,
	"submitted_by" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"start_date" date,
	"end_date" date,
	"details" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_requests_reference_number_unique" UNIQUE("reference_number")
);
--> statement-breakpoint
ALTER TABLE "hr_administrative_decisions" ADD CONSTRAINT "hr_administrative_decisions_employee_id_hr_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hr_employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_audit_log" ADD CONSTRAINT "hr_audit_log_employee_id_hr_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hr_employees"("employee_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_audit_log" ADD CONSTRAINT "hr_audit_log_actor_id_auth_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_employee_id_hr_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hr_employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_employment_record_id_hr_employment_records_employment_record_id_fk" FOREIGN KEY ("employment_record_id") REFERENCES "public"."hr_employment_records"("employment_record_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_certificate_id_hr_employee_certificates_certificate_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."hr_employee_certificates"("certificate_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_decision_id_hr_administrative_decisions_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."hr_administrative_decisions"("decision_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_uploaded_by_auth_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employee_certificates" ADD CONSTRAINT "hr_employee_certificates_employee_id_hr_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hr_employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employment_grades" ADD CONSTRAINT "hr_employment_grades_scheme_id_hr_grade_schemes_scheme_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."hr_grade_schemes"("scheme_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employment_records" ADD CONSTRAINT "hr_employment_records_employee_id_hr_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hr_employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employment_records" ADD CONSTRAINT "hr_employment_records_category_id_hr_staff_categories_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."hr_staff_categories"("category_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employment_records" ADD CONSTRAINT "hr_employment_records_position_id_hr_positions_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."hr_positions"("position_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employment_records" ADD CONSTRAINT "hr_employment_records_academic_rank_id_hr_academic_ranks_rank_id_fk" FOREIGN KEY ("academic_rank_id") REFERENCES "public"."hr_academic_ranks"("rank_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employment_records" ADD CONSTRAINT "hr_employment_records_grade_id_hr_employment_grades_grade_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."hr_employment_grades"("grade_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_positions" ADD CONSTRAINT "hr_positions_category_id_hr_staff_categories_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."hr_staff_categories"("category_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_reviews" ADD CONSTRAINT "hr_request_reviews_request_id_hr_requests_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."hr_requests"("request_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_reviews" ADD CONSTRAINT "hr_request_reviews_reviewer_id_auth_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_employee_id_hr_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hr_employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_request_type_id_hr_request_types_request_type_id_fk" FOREIGN KEY ("request_type_id") REFERENCES "public"."hr_request_types"("request_type_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_submitted_by_auth_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hr_academic_ranks_order_idx" ON "hr_academic_ranks" USING btree ("rank_order");--> statement-breakpoint
CREATE INDEX "hr_administrative_decisions_employee_idx" ON "hr_administrative_decisions" USING btree ("employee_id","decision_date");--> statement-breakpoint
CREATE INDEX "hr_audit_log_employee_idx" ON "hr_audit_log" USING btree ("employee_id","created_at");--> statement-breakpoint
CREATE INDEX "hr_documents_employee_idx" ON "hr_documents" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "hr_employee_certificates_employee_idx" ON "hr_employee_certificates" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "hr_employees_name_idx" ON "hr_employees" USING btree ("last_name_ar","first_name_ar");--> statement-breakpoint
CREATE INDEX "hr_employment_records_employee_idx" ON "hr_employment_records" USING btree ("employee_id","start_date");--> statement-breakpoint
CREATE INDEX "hr_employment_records_current_idx" ON "hr_employment_records" USING btree ("employee_id","is_current");--> statement-breakpoint
CREATE INDEX "hr_request_reviews_request_idx" ON "hr_request_reviews" USING btree ("request_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "hr_requests_employee_status_idx" ON "hr_requests" USING btree ("employee_id","status");--> statement-breakpoint
CREATE INDEX "hr_requests_type_submitted_idx" ON "hr_requests" USING btree ("request_type_id","submitted_at");