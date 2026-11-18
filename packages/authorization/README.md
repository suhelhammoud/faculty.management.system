# Authorization catalog

`src/permissions.ts` is the version-controlled catalog of permission keys, descriptions, and module role defaults. API permission decorators and database catalog seeding consume this package so the key strings have one source.

After adding a permission, use the shared constant in the API and run `pnpm --filter @project/db seed:permissions` after migrations. The seed command adds catalog entries and updates descriptions without deleting entries or changing role grants. Grant new permissions to existing roles through administration or a deliberate data migration.

Role defaults are applied only by the fresh administrator bootstrap. Changes to those defaults do not silently rewrite existing role assignments.
