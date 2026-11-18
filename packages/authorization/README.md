# Authorization catalog

`src/permissions.ts` is the version-controlled catalog of permission keys and descriptions. `src/roles.ts` defines the shared Administrator, HR Administrator, and Facilities Administrator role templates. API permission decorators and database catalog seeding consume this package so the key strings have one source.

After adding a permission, use the shared constant in the API and run `pnpm --filter @project/db seed:permissions` after migrations. The seed command adds catalog entries and updates descriptions without deleting entries or changing role grants. Grant new permissions to existing roles through administration or a deliberate data migration.

Role defaults are applied by the fresh administrator bootstrap and by local demo seeding. Local seeding adds missing default grants to the demo roles on each run without removing existing grants. The permission catalog seed does not change role grants.
