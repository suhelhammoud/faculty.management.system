CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"username" text,
	"display_username" text,
	"approved" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email"),
	CONSTRAINT "auth_user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"target_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"key" text PRIMARY KEY NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "resource_acl" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"permission" text NOT NULL,
	"effect" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" text NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_pk" PRIMARY KEY("role_id","permission")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "facilities_buildings" (
	"building_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_code" text NOT NULL,
	"title" text NOT NULL,
	"address" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facilities_buildings_building_code_unique" UNIQUE("building_code")
);
--> statement-breakpoint
CREATE TABLE "facilities_floors" (
	"floor_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"floor_number" integer NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facilities_floors_building_number_unique" UNIQUE("building_id","floor_number"),
	CONSTRAINT "facilities_floors_id_building_unique" UNIQUE("floor_id","building_id")
);
--> statement-breakpoint
CREATE TABLE "facilities_room_types" (
	"room_type_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facilities_room_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "facilities_rooms" (
	"room_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"floor_id" uuid NOT NULL,
	"room_type_id" uuid NOT NULL,
	"room_code" text NOT NULL,
	"title" text NOT NULL,
	"maximum_student_capacity" integer,
	"current_available_student_capacity" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facilities_rooms_building_code_unique" UNIQUE("building_id","room_code"),
	CONSTRAINT "facilities_rooms_capacity_nonnegative_check" CHECK (("facilities_rooms"."maximum_student_capacity" is null or "facilities_rooms"."maximum_student_capacity" >= 0)
        and ("facilities_rooms"."current_available_student_capacity" is null or "facilities_rooms"."current_available_student_capacity" >= 0)),
	CONSTRAINT "facilities_rooms_available_capacity_check" CHECK ("facilities_rooms"."current_available_student_capacity" is null
        or "facilities_rooms"."maximum_student_capacity" is null
        or "facilities_rooms"."current_available_student_capacity" <= "facilities_rooms"."maximum_student_capacity")
);
--> statement-breakpoint
CREATE TABLE "hr_academic_ranks" (
	"rank_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"rank_order" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_academic_ranks_code_unique" UNIQUE("code"),
	CONSTRAINT "hr_academic_ranks_order_unique" UNIQUE("rank_order"),
	CONSTRAINT "hr_academic_ranks_order_range_check" CHECK ("hr_academic_ranks"."rank_order" between 1 and 5)
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
	"previous_values" jsonb,
	"new_values" jsonb,
	"reason" text,
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
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_employees_employee_number_unique" UNIQUE("employee_number"),
	CONSTRAINT "hr_employees_user_id_unique" UNIQUE("user_id")
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
	"sha256" text,
	"description" text,
	"uploaded_by" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_documents_exactly_one_owner_check" CHECK (num_nonnulls("hr_documents"."employee_id", "hr_documents"."employment_record_id", "hr_documents"."certificate_id", "hr_documents"."decision_id") = 1)
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
	"employment_status" text DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"decision_number" text,
	"decision_date" date,
	"is_current" smallint DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_employment_records_is_current_check" CHECK ("hr_employment_records"."is_current" in (0, 1))
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
CREATE TABLE "hr_request_documents" (
	"request_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_request_documents_request_document_unique" UNIQUE("request_id","document_id")
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
CREATE TABLE "student_academic_years" (
	"student_id" uuid NOT NULL,
	"year" smallint NOT NULL,
	"academic_year" text NOT NULL,
	"first_term_fee" numeric(12, 2),
	"first_term_receipt_number" text,
	"first_term_receipt_date" date,
	"second_term_fee" numeric(12, 2),
	"second_term_receipt_number" text,
	"second_term_receipt_date" date,
	"certificate_receipt_number" text,
	"certificate_receipt_date" date,
	"first_term_result" text,
	"second_term_result" text,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_academic_years_student_id_academic_year_pk" PRIMARY KEY("student_id","academic_year")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"student_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academic_id" text NOT NULL,
	"user_id" text,
	"birth_place" text,
	"birth_date" date,
	"mother_name" text,
	"civil_registry_place" text,
	"civil_registry_number" text,
	"nationality" text,
	"governorate" text,
	"permanent_address" text,
	"homs_address" text,
	"mobile_number" text,
	"phone_number" text,
	"email" text,
	"enrollment_date" date,
	"secondary_certificate" text,
	"certificate_type" text,
	"certificate_date" date,
	"grade_average" numeric(10, 2),
	"equivalency_decision" text,
	"total_score" numeric(12, 2),
	"adjusted_score" numeric(12, 2),
	"language" text,
	"gender" text,
	"exam_registration_number" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_academic_id_unique" UNIQUE("academic_id"),
	CONSTRAINT "students_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_acl" ADD CONSTRAINT "resource_acl_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_acl" ADD CONSTRAINT "resource_acl_permission_permissions_key_fk" FOREIGN KEY ("permission") REFERENCES "public"."permissions"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_permissions_key_fk" FOREIGN KEY ("permission") REFERENCES "public"."permissions"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities_floors" ADD CONSTRAINT "facilities_floors_building_id_facilities_buildings_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."facilities_buildings"("building_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities_rooms" ADD CONSTRAINT "facilities_rooms_room_type_id_facilities_room_types_room_type_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."facilities_room_types"("room_type_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities_rooms" ADD CONSTRAINT "facilities_rooms_floor_building_fk" FOREIGN KEY ("floor_id","building_id") REFERENCES "public"."facilities_floors"("floor_id","building_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_administrative_decisions" ADD CONSTRAINT "hr_administrative_decisions_employee_id_hr_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hr_employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_audit_log" ADD CONSTRAINT "hr_audit_log_employee_id_hr_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hr_employees"("employee_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_audit_log" ADD CONSTRAINT "hr_audit_log_actor_id_auth_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employee_certificates" ADD CONSTRAINT "hr_employee_certificates_employee_id_hr_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hr_employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_employee_id_hr_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hr_employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_employment_record_id_hr_employment_records_employment_record_id_fk" FOREIGN KEY ("employment_record_id") REFERENCES "public"."hr_employment_records"("employment_record_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_certificate_id_hr_employee_certificates_certificate_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."hr_employee_certificates"("certificate_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_decision_id_hr_administrative_decisions_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."hr_administrative_decisions"("decision_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_uploaded_by_auth_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employment_grades" ADD CONSTRAINT "hr_employment_grades_scheme_id_hr_grade_schemes_scheme_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."hr_grade_schemes"("scheme_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employment_records" ADD CONSTRAINT "hr_employment_records_employee_id_hr_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hr_employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employment_records" ADD CONSTRAINT "hr_employment_records_category_id_hr_staff_categories_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."hr_staff_categories"("category_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employment_records" ADD CONSTRAINT "hr_employment_records_position_id_hr_positions_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."hr_positions"("position_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employment_records" ADD CONSTRAINT "hr_employment_records_academic_rank_id_hr_academic_ranks_rank_id_fk" FOREIGN KEY ("academic_rank_id") REFERENCES "public"."hr_academic_ranks"("rank_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_employment_records" ADD CONSTRAINT "hr_employment_records_grade_id_hr_employment_grades_grade_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."hr_employment_grades"("grade_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_positions" ADD CONSTRAINT "hr_positions_category_id_hr_staff_categories_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."hr_staff_categories"("category_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_documents" ADD CONSTRAINT "hr_request_documents_request_id_hr_requests_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."hr_requests"("request_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_documents" ADD CONSTRAINT "hr_request_documents_document_id_hr_documents_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."hr_documents"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_reviews" ADD CONSTRAINT "hr_request_reviews_request_id_hr_requests_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."hr_requests"("request_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_reviews" ADD CONSTRAINT "hr_request_reviews_reviewer_id_auth_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_workflow_steps" ADD CONSTRAINT "hr_request_workflow_steps_request_type_id_hr_request_types_request_type_id_fk" FOREIGN KEY ("request_type_id") REFERENCES "public"."hr_request_types"("request_type_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_workflow_steps" ADD CONSTRAINT "hr_request_workflow_steps_reviewer_role_id_roles_id_fk" FOREIGN KEY ("reviewer_role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_employee_id_hr_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hr_employees"("employee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_request_type_id_hr_request_types_request_type_id_fk" FOREIGN KEY ("request_type_id") REFERENCES "public"."hr_request_types"("request_type_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_submitted_by_auth_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_academic_years" ADD CONSTRAINT "student_academic_years_student_id_students_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acl_lookup" ON "resource_acl" USING btree ("user_id","resource_type","resource_id","permission");--> statement-breakpoint
CREATE INDEX "hr_academic_ranks_order_idx" ON "hr_academic_ranks" USING btree ("rank_order");--> statement-breakpoint
CREATE INDEX "hr_administrative_decisions_employee_idx" ON "hr_administrative_decisions" USING btree ("employee_id","decision_date");--> statement-breakpoint
CREATE INDEX "hr_audit_log_employee_idx" ON "hr_audit_log" USING btree ("employee_id","created_at");--> statement-breakpoint
CREATE INDEX "hr_employee_certificates_employee_idx" ON "hr_employee_certificates" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "hr_employees_name_idx" ON "hr_employees" USING btree ("last_name_ar","first_name_ar");--> statement-breakpoint
CREATE INDEX "hr_documents_employee_idx" ON "hr_documents" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "hr_employment_records_employee_idx" ON "hr_employment_records" USING btree ("employee_id","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "hr_employment_records_one_current_per_employee_idx" ON "hr_employment_records" USING btree ("employee_id") WHERE "hr_employment_records"."is_current" = 1;--> statement-breakpoint
CREATE INDEX "hr_request_reviews_request_idx" ON "hr_request_reviews" USING btree ("request_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "hr_requests_employee_status_idx" ON "hr_requests" USING btree ("employee_id","status");--> statement-breakpoint
CREATE INDEX "hr_requests_type_submitted_idx" ON "hr_requests" USING btree ("request_type_id","submitted_at");