CREATE TABLE "inventory_discrepancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" text NOT NULL,
	"custody_id" uuid NOT NULL,
	"category" text NOT NULL,
	"details" text NOT NULL,
	"asset_revision" integer NOT NULL,
	"room_id" uuid,
	"condition" text NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewer_id" text,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	CONSTRAINT "inventory_discrepancies_category_check" CHECK ("inventory_discrepancies"."category" in ('assignment', 'room', 'condition')),
	CONSTRAINT "inventory_discrepancies_review_check" CHECK (
      ("inventory_discrepancies"."reviewer_id" is null and "inventory_discrepancies"."reviewed_at" is null and "inventory_discrepancies"."review_note" is null)
      or
      ("inventory_discrepancies"."reviewer_id" is not null and "inventory_discrepancies"."reviewed_at" is not null and "inventory_discrepancies"."review_note" is not null)
    )
);
--> statement-breakpoint
ALTER TABLE "inventory_discrepancies" ADD CONSTRAINT "inventory_discrepancies_reporter_id_auth_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_discrepancies" ADD CONSTRAINT "inventory_discrepancies_custody_id_inventory_custodies_id_fk" FOREIGN KEY ("custody_id") REFERENCES "public"."inventory_custodies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_discrepancies" ADD CONSTRAINT "inventory_discrepancies_room_id_facilities_rooms_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."facilities_rooms"("room_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_discrepancies" ADD CONSTRAINT "inventory_discrepancies_reviewer_id_auth_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_discrepancies_one_open_idx" ON "inventory_discrepancies" USING btree ("reporter_id","custody_id","category") WHERE "inventory_discrepancies"."reviewed_at" is null;--> statement-breakpoint
CREATE INDEX "inventory_discrepancies_queue_idx" ON "inventory_discrepancies" USING btree ("reported_at","id");