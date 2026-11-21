# Authorization catalog

`src/permissions.ts` is the version-controlled catalog of permission keys and descriptions. `src/roles.ts` defines the shared Administrator, HR Administrator, and Facilities Administrator role templates. API permission decorators and database catalog seeding consume this package so the key strings have one source.

`ELEVATED_PERMISSION_SCOPES` identifies the existing permission keys eligible for direct elevated grants. A named resource type enables optional record scope. A `null` value means the grant applies globally. The API and local fixture validation share this list. [Shared authorization guide](../../docs/modules/authorization/README.md#elevated-grants)

After adding a permission, use the shared constant in the API and run `pnpm --filter @project/db seed:permissions` after migrations. The seed command adds catalog entries and updates descriptions without deleting entries or changing role grants. Grant new permissions to existing roles through administration or a deliberate data migration.

Role defaults are applied by the fresh administrator bootstrap and by local demo seeding. Local seeding adds missing default role grants and inserts the demo elevated grants on first run. Reruns preserve each elevated grant’s expiry, remaining attempts, and revocation state.
