CREATE TABLE "elevated_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"permission" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"max_uses" integer NOT NULL,
	"remaining_uses" integer NOT NULL,
	"granted_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "elevated_grants_scope" CHECK (("elevated_grants"."resource_type" is null) = ("elevated_grants"."resource_id" is null)),
	CONSTRAINT "elevated_grants_uses" CHECK ("elevated_grants"."max_uses" > 0 and "elevated_grants"."remaining_uses" between 0 and "elevated_grants"."max_uses")
);
--> statement-breakpoint
ALTER TABLE "elevated_grants" ADD CONSTRAINT "elevated_grants_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elevated_grants" ADD CONSTRAINT "elevated_grants_permission_permissions_key_fk" FOREIGN KEY ("permission") REFERENCES "public"."permissions"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "elevated_grants_lookup" ON "elevated_grants" USING btree ("user_id","permission","expires_at");