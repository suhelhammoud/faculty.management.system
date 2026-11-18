# Shared authorization

This document describes how permission definitions, roles, grants, and permission seeding work in the shared API. The implementation lives in the `@project/authorization` workspace package, the Drizzle database package, and `apps/api`.

## Model and sources of truth

Authorization has two kinds of state:

| Concern                                                        | Source of truth                                               | Purpose                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| Supported permission keys and descriptions                     | `packages/authorization/src/permissions.ts`                   | Versioned application contract used by API code and catalog seeding |
| Initial module role templates                                  | `packages/authorization/src/permissions.ts`                   | Defaults used only when bootstrapping a new administrator           |
| Roles, user-to-role assignments, and role-to-permission grants | PostgreSQL                                                    | Live, administrator-managed access configuration                    |
| Permission catalog rows                                        | PostgreSQL `permissions` table, synchronized from the package | Runtime catalog used by administration APIs and foreign keys        |

Permissions identify actions, such as `hr-employees:read` or `facilities:write`. API handlers use the typed `PERMISSION` constants with `@RequirePermission`, so misspelled or undeclared keys fail type checking. The catalog also stores a human-readable description for the administration UI.

The API aggregates global role grants across a user's assigned roles. For resource-scoped checks, a matching ACL deny takes precedence, then a matching ACL allow, then the user's role grants. Endpoints without an authorization annotation are denied by default. Role grants do not define which records a user may see inside a module; add module-specific record or organizational scope checks when that requirement is defined.

## Permission catalog package

`@project/authorization` is a small, database-independent workspace package shared by the API and `@project/db`:

- `PERMISSION` provides typed constants for use in guards and decorators.
- `PERMISSION_CATALOG` lists every supported key and its description.
- `HR_PERMISSIONS` and `FACILITIES_PERMISSIONS` group module keys.
- `DEFAULT_ROLE_TEMPLATES` defines the initial HR Administrator and Facilities Administrator roles and their grants.

The bootstrap administrator receives all permissions present in the catalog at bootstrap time. The module role templates are also applied during that fresh bootstrap; no user is automatically assigned to either module role.

The current catalog includes:

| Area              | Permission keys                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Accounts          | `users:read`, `users:create`, `users:approve`, `users:reset-password`, `users:assign-roles` |
| Roles             | `roles:read`, `roles:create`, `roles:update`                                                |
| Audit             | `audit:read`                                                                                |
| HR employees      | `hr-employees:read`, `hr-employees:create`, `hr-employees:update`                           |
| HR reference data | `hr-reference-data:read`, `hr-reference-data:write`                                         |
| Facilities        | `facilities:read`, `facilities:write`                                                       |

## Catalog seed and deployment

Run database migrations first, then synchronize the catalog:

```sh
pnpm --filter @project/db migrate
pnpm --filter @project/db seed:permissions
```

The seed command is explicit and can run against existing installations. It inserts missing permission rows and updates descriptions for existing keys. It does not delete catalog rows, create or edit roles, assign permissions to roles, or change user-role assignments. It must complete before the API uses a newly added permission.

Run the seed command after migrations during each deployment. It does not run automatically when the API starts. The `permissions` table remains necessary at runtime: the admin API lists catalog rows from it, and role grants and ACL entries reference those keys.

The SQL migrations `0001_hr-admin-permissions.sql` and `0002_facilities-permissions.sql` are retained as historical migration records. They still provide their original initial role and grant data when migrations run. Do not edit already-applied migrations. New permission definitions and descriptions belong in the authorization package and are synchronized by the seed command.

## Managing live roles and grants

Administrators manage current roles, user assignments, and grants through the shared Administration API. The seed command intentionally leaves these records alone so a deployment cannot erase administrator changes.

Adding a permission to the catalog makes it available for new role grants; it does not grant it to existing roles. Add grants for existing installations through role administration or a separate, reviewed data migration when a deployment requires a specific grant. Changes to a configured module role template affect fresh administrator bootstrap only; they do not reconcile existing grants.

Permission grant/removal and user role assignment mutations are audited by the API. Permission changes revoke sessions for affected users where the endpoint requires it; authorization itself reads current database grants rather than embedding grants in sessions.

## Adding a permission

1. Add its literal to `PERMISSION` and add a `{ key, description }` entry to `PERMISSION_CATALOG` in `packages/authorization/src/permissions.ts`.
2. Use the typed constant in the API's `@RequirePermission` decorator. Add it to a module role template only if fresh bootstrap should grant it to that template.
3. Deploy the package and run `pnpm --filter @project/db seed:permissions` after migrations.
4. Grant the permission to existing roles through Administration, or include a deliberate data migration if the rollout requires an automatic grant.

No schema migration is needed to add a permission key. The seed command is idempotent, so it is safe to rerun.

## Retiring a permission

The catalog seeder never deletes rows. Removing a key from source code alone leaves the database row visible and may leave role grants or ACL records referencing it. Remove the permission from API enforcement only as part of a reviewed retirement; inspect and remove its role grants and ACL references through a deliberate data change before deleting the database row. The current catalog has no `deprecated` or `active` field, so do not expect deployments to hide retired keys automatically.

## Related implementation and setup

- [API authentication and authorization setup](../../auth-api-setup.md)
- [Authorization catalog package](../../../packages/authorization/README.md)
- [HR API access and setup](../hr/API.md)
- [Facilities API access and setup](../facilities/API.md)
