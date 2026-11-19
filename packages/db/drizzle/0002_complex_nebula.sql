CREATE TABLE "inventory_balances" (
	"consumable_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "inventory_balances_consumable_id_room_id_pk" PRIMARY KEY("consumable_id","room_id"),
	CONSTRAINT "inventory_balance_nonnegative" CHECK ("inventory_balances"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_consumables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	CONSTRAINT "inventory_consumables_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "inventory_shared_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "inventory_shared_accounts_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "inventory_storage" (
	"room_id" uuid PRIMARY KEY NOT NULL,
	"shared_account_id" uuid NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "inventory_storage_enabled_check" CHECK ("inventory_storage"."enabled" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE "inventory_transaction_lines" (
	"transaction_id" uuid NOT NULL,
	"line" integer NOT NULL,
	"asset_id" uuid,
	"consumable_id" uuid,
	"quantity" integer,
	"before" jsonb,
	"after" jsonb,
	"outcome" text,
	"reason" text,
	CONSTRAINT "inventory_transaction_lines_transaction_id_line_pk" PRIMARY KEY("transaction_id","line"),
	CONSTRAINT "inventory_transaction_line_item_check" CHECK (
    ("inventory_transaction_lines"."asset_id" is not null and "inventory_transaction_lines"."consumable_id" is null and "inventory_transaction_lines"."quantity" is null)
    or ("inventory_transaction_lines"."asset_id" is null and "inventory_transaction_lines"."consumable_id" is not null and "inventory_transaction_lines"."quantity" is not null and "inventory_transaction_lines"."quantity" <> 0)
  )
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"reference" text,
	"event_date" date NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text NOT NULL,
	"source" text,
	"source_room_id" uuid,
	"destination_room_id" uuid,
	"recipient_employee_id" uuid,
	"notes" text,
	"decision_id" uuid,
	"idempotency_key" text,
	"input_hash" text,
	CONSTRAINT "inventory_transactions_decision_id_unique" UNIQUE("decision_id"),
	CONSTRAINT "inventory_transaction_actor_key_unique" UNIQUE("actor_id","idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "inventory_custodies" ALTER COLUMN "employee_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_assets" ADD COLUMN "condition" text DEFAULT 'unassessed' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_assets" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "inventory_assets" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "inventory_assets" ADD COLUMN "serial_number" text;--> statement-breakpoint
ALTER TABLE "inventory_assets" ADD COLUMN "acquisition_reference" text;--> statement-breakpoint
ALTER TABLE "inventory_assets" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "inventory_assets" ADD COLUMN "room_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_assets" ADD COLUMN "created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inventory_assets" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inventory_custodies" ADD COLUMN "shared_account_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_consumable_id_inventory_consumables_id_fk" FOREIGN KEY ("consumable_id") REFERENCES "public"."inventory_consumables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_room_id_inventory_storage_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."inventory_storage"("room_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_storage" ADD CONSTRAINT "inventory_storage_room_id_facilities_rooms_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."facilities_rooms"("room_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_storage" ADD CONSTRAINT "inventory_storage_shared_account_id_inventory_shared_accounts_id_fk" FOREIGN KEY ("shared_account_id") REFERENCES "public"."inventory_shared_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_transaction_id_inventory_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."inventory_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_asset_id_inventory_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."inventory_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_consumable_id_inventory_consumables_id_fk" FOREIGN KEY ("consumable_id") REFERENCES "public"."inventory_consumables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_actor_id_auth_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_source_room_id_facilities_rooms_room_id_fk" FOREIGN KEY ("source_room_id") REFERENCES "public"."facilities_rooms"("room_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_destination_room_id_facilities_rooms_room_id_fk" FOREIGN KEY ("destination_room_id") REFERENCES "public"."facilities_rooms"("room_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_recipient_employee_id_hr_employees_employee_id_fk" FOREIGN KEY ("recipient_employee_id") REFERENCES "public"."hr_employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_decision_id_inventory_removal_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."inventory_removal_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_transaction_asset_idx" ON "inventory_transaction_lines" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "inventory_transaction_consumable_idx" ON "inventory_transaction_lines" USING btree ("consumable_id");--> statement-breakpoint
CREATE INDEX "inventory_transaction_history_idx" ON "inventory_transactions" USING btree ("event_date","id");--> statement-breakpoint
ALTER TABLE "inventory_assets" ADD CONSTRAINT "inventory_assets_room_id_facilities_rooms_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."facilities_rooms"("room_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_custodies" ADD CONSTRAINT "inventory_custodies_shared_account_id_inventory_shared_accounts_id_fk" FOREIGN KEY ("shared_account_id") REFERENCES "public"."inventory_shared_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_custodies" ADD CONSTRAINT "inventory_custody_one_party" CHECK (("inventory_custodies"."employee_id" is null) <> ("inventory_custodies"."shared_account_id" is null));
--> statement-breakpoint
INSERT INTO inventory_shared_accounts (id, name)
VALUES ('00000000-0000-4000-8000-000000000001', 'Unassigned Inventory');
--> statement-breakpoint
WITH backfilled AS (
  INSERT INTO inventory_custodies (asset_id, shared_account_id)
  SELECT a.id, '00000000-0000-4000-8000-000000000001'
  FROM inventory_assets a
  WHERE a.status = 'active' AND NOT EXISTS (
    SELECT 1 FROM inventory_custodies c WHERE c.asset_id = a.id AND c.ended_at IS NULL
  )
  RETURNING id, asset_id
)
UPDATE inventory_removal_items i SET custody_id = b.id
FROM backfilled b, inventory_assets a, inventory_removal_requests r, workflow_instances w
WHERE i.asset_id = b.asset_id AND a.id = b.asset_id AND i.asset_revision = a.revision
  AND i.custody_id IS NULL AND i.request_id = r.id AND i.revision = r.current_revision
  AND w.subject_id = r.id::text AND w.subject_module = 'inventory'
  AND w.subject_type = 'removal-request' AND w.status = 'running';
--> statement-breakpoint
INSERT INTO inventory_transactions (type, name, reference, event_date, recorded_at, actor_id, decision_id)
SELECT 'committee-decision', name, reference, decided_on, recorded_at, actor_id, id
FROM inventory_removal_decisions;
--> statement-breakpoint
INSERT INTO inventory_transaction_lines (transaction_id, line, asset_id, outcome, reason)
SELECT t.id, row_number() OVER (PARTITION BY t.id ORDER BY i.asset_id), i.asset_id, i.outcome, i.decision_reason
FROM inventory_transactions t JOIN inventory_removal_decisions d ON d.id = t.decision_id
JOIN inventory_removal_items i ON i.request_id = d.request_id AND i.revision = d.revision;
