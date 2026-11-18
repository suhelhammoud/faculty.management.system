CREATE TABLE "workflow_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"task_id" uuid,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"comment" text,
	"domain_reference" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"idempotency_scope" text,
	"idempotency_key" text,
	"input_hash" text,
	"result" jsonb
);
--> statement-breakpoint
CREATE TABLE "workflow_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_key" text NOT NULL,
	"definition_version" integer NOT NULL,
	"subject_module" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"started_by" text NOT NULL,
	"status" text NOT NULL,
	"current_step" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workflow_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"step" text NOT NULL,
	"assigned_user_id" text,
	"status" text NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inventory_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "inventory_assets_tag_unique" UNIQUE("tag")
);
--> statement-breakpoint
CREATE TABLE "inventory_custodies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inventory_removal_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"actor_id" text NOT NULL,
	"name" text NOT NULL,
	"reference" text NOT NULL,
	"decided_on" date NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_removal_decisions_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "inventory_removal_items" (
	"request_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"asset_id" uuid NOT NULL,
	"asset_revision" integer NOT NULL,
	"custody_id" uuid,
	"reason" text NOT NULL,
	"outcome" text,
	"decision_reason" text,
	CONSTRAINT "inventory_removal_items_request_id_revision_asset_id_pk" PRIMARY KEY("request_id","revision","asset_id")
);
--> statement-breakpoint
CREATE TABLE "inventory_removal_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" text NOT NULL,
	"current_revision" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_instance_id_workflow_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_task_id_workflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."workflow_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_actor_id_auth_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_started_by_auth_user_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_instance_id_workflow_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_assigned_user_id_auth_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_custodies" ADD CONSTRAINT "inventory_custodies_asset_id_inventory_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."inventory_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_custodies" ADD CONSTRAINT "inventory_custodies_employee_id_hr_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hr_employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_removal_decisions" ADD CONSTRAINT "inventory_removal_decisions_request_id_inventory_removal_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."inventory_removal_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_removal_decisions" ADD CONSTRAINT "inventory_removal_decisions_actor_id_auth_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_removal_items" ADD CONSTRAINT "inventory_removal_items_request_id_inventory_removal_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."inventory_removal_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_removal_items" ADD CONSTRAINT "inventory_removal_items_asset_id_inventory_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."inventory_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_removal_items" ADD CONSTRAINT "inventory_removal_items_custody_id_inventory_custodies_id_fk" FOREIGN KEY ("custody_id") REFERENCES "public"."inventory_custodies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_removal_requests" ADD CONSTRAINT "inventory_removal_requests_requester_id_auth_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_events_history_idx" ON "workflow_events" USING btree ("instance_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_events_idempotency_idx" ON "workflow_events" USING btree ("actor_id","idempotency_scope","idempotency_key");--> statement-breakpoint
CREATE INDEX "workflow_instances_monitor_idx" ON "workflow_instances" USING btree ("status","current_step");--> statement-breakpoint
CREATE INDEX "workflow_instances_subject_idx" ON "workflow_instances" USING btree ("subject_module","subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_tasks_one_pending_idx" ON "workflow_tasks" USING btree ("instance_id") WHERE "workflow_tasks"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "workflow_tasks_instance_idx" ON "workflow_tasks" USING btree ("instance_id","opened_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_custodies_one_active_idx" ON "inventory_custodies" USING btree ("asset_id") WHERE "inventory_custodies"."ended_at" is null;