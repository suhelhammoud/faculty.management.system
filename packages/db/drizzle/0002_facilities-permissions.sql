INSERT INTO "permissions" ("key") VALUES
  ('facilities:read'),
  ('facilities:write')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "roles" ("id", "name") VALUES
  ('facilities-administrator', 'Facilities Administrator')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT r.id, p.key FROM "roles" r CROSS JOIN "permissions" p
WHERE r.name IN ('Administrator', 'Facilities Administrator')
AND p.key IN ('facilities:read', 'facilities:write')
ON CONFLICT DO NOTHING;
