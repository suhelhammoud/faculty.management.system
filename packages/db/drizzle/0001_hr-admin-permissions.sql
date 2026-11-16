INSERT INTO "permissions" ("key") VALUES
  ('hr-employees:read'),
  ('hr-employees:create'),
  ('hr-employees:update'),
  ('hr-reference-data:read'),
  ('hr-reference-data:write')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "roles" ("id", "name") VALUES ('hr-administrator', 'HR Administrator')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT r.id, p.key FROM "roles" r CROSS JOIN "permissions" p
WHERE r.name IN ('Administrator', 'HR Administrator')
AND p.key IN ('hr-employees:read', 'hr-employees:create', 'hr-employees:update', 'hr-reference-data:read', 'hr-reference-data:write')
ON CONFLICT DO NOTHING;
