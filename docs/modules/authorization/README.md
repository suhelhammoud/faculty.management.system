# Shared authorization

This document describes how permission definitions, roles, grants, and permission seeding work in the shared API. The implementation lives in the `@project/authorization` workspace package, the Drizzle database package, and `apps/api`.

## Model and sources of truth

A **permission** names an action, such as `hr-employees:read` or `facilities:write`. A **role** is a named bundle of permissions. A user with both HR Administrator and Facilities Administrator gets the combined permissions from those roles. A **resource access rule** (ACL) allows or denies an action for one user on one record. An **elevated grant** gives one user access to one existing permission until a deadline or an attempt limit, whichever comes first.

| Source                                               | What it defines or stores                                    |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `packages/authorization/src/permissions.ts`          | Supported permission keys, descriptions, and elevated scopes |
| `packages/authorization/src/roles.ts`                | Default role templates for bootstrap and local seeding       |
| PostgreSQL `permissions`                             | Permission catalog synchronized from TypeScript              |
| PostgreSQL `roles`, `user_roles`, `role_permissions` | Live roles, their users, and their permission grants         |
| PostgreSQL `resource_acl` and `elevated_grants`      | Record-level access rules and direct elevated grants         |

## How the API checks a request

1. **Check the session and account.** Better Auth identifies the signed-in user. For protected application endpoints, the account must be approved, enabled, and have completed any required password change. Protected endpoints without an authorization policy deny access.
2. **Check record-level rules.** If the action targets a specific record, the API checks ACL entries matching the user, permission, and record. A matching deny blocks the action. Otherwise, a matching allow grants access.
3. **Check roles.** Any assigned role with the required permission grants access. The API reads current access from PostgreSQL on requests. Modules may apply additional record, ownership, or workflow rules.
4. **Check elevated access.** An endpoint that supports elevation can use a matching, unexpired, unrevoked grant with attempts remaining. If an earlier step granted access, the user keeps their elevated attempts. If no rule grants access, the API denies the action.

## Elevated grants

An administrator can give a user one permission across all records it covers, or limit the grant to one supported record. The same attempt limit applies across all eligible actions covered by that permission and scope. When several grants match, the API prefers a record-specific grant over a global grant, then the earlier expiry.

| Permission                | Eligible actions                                                           | Optional record scope         |
| ------------------------- | -------------------------------------------------------------------------- | ----------------------------- |
| `users:create`            | Create an account                                                          | Global only                   |
| `users:approve`           | Approve, enable, or disable an account                                     | One user account              |
| `users:reset-password`    | Reset an account password                                                  | One user account              |
| `hr-employees:create`     | Create an employee profile                                                 | Global only                   |
| `hr-employees:update`     | Update an employee profile or current employment record                    | Global only                   |
| `hr-reference-data:write` | Create or update HR reference data                                         | Global only                   |
| `facilities:write`        | Create or update buildings, floors, room types, and rooms                  | Global only                   |
| `inventory:configure`     | Configure storage and create shared accounts or consumable catalog entries | Global only                   |
| `inventory:manage-assets` | Register an asset or change its custody                                    | One asset for custody changes |

Read access, role management, inventory posting, and workflow actions continue to use their standard authorization rules. The API claims one attempt atomically after request validation and before running the action. The attempt stays spent if the action fails. Read-only capability checks leave the counter intact.

For example, the local `elevation_demo` user can approve `staff_two` once before the seeded grant expires. An attempt to approve another user is denied. Once the allowed attempt is claimed, another approval request using the same grant is denied. [Local elevated-access demo](../../../packages/db/src/seed/README.md#elevated-access-demo) · [Grant management API](../../auth-api-setup.md#elevated-grants)

## Permission catalog package

`@project/authorization` is a small, database-independent workspace package shared by the API and `@project/db`:

- `PERMISSION` provides typed constants for use in guards and decorators.
- `PERMISSION_CATALOG` lists every supported key and its description.
- `ELEVATED_PERMISSION_SCOPES` lists permissions eligible for elevation and any supported record scope.
- `HR_PERMISSIONS` and `FACILITIES_PERMISSIONS` group module keys.
- `DEFAULT_ROLE_TEMPLATES` defines the initial HR Administrator and Facilities Administrator roles and their grants.

The bootstrap administrator receives all permissions present in the catalog at bootstrap time. The module role templates are also applied during that fresh bootstrap; no user is automatically assigned to either module role.

The catalog groups permissions by area.

| Area              | Permission keys                                                                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts          | `users:read`, `users:create`, `users:approve`, `users:reset-password`, `users:assign-roles`                                                                                                                 |
| Roles             | `roles:read`, `roles:create`, `roles:update`                                                                                                                                                                |
| Audit             | `audit:read`                                                                                                                                                                                                |
| HR employees      | `hr-employees:read`, `hr-employees:create`, `hr-employees:update`                                                                                                                                           |
| HR reference data | `hr-reference-data:read`, `hr-reference-data:write`                                                                                                                                                         |
| Facilities        | `facilities:read`, `facilities:write`                                                                                                                                                                       |
| Inventory         | `inventory:read`, `inventory:configure`, `inventory:post-transactions`, `inventory:dispose`, `inventory:manage-assets`, `inventory:request-removal`, `inventory:removal-review`, `inventory:removal-decide` |
| Workflows         | `workflow:monitor`                                                                                                                                                                                          |

## Catalog seed and deployment

Run database migrations first, then synchronize the catalog:

```sh
pnpm --filter @project/db migrate
pnpm --filter @project/db seed:permissions
```

Run the seed command after migrations during each deployment. It inserts missing catalog rows and updates descriptions. Live roles, role assignments, ACL rules, and elevated grants are managed separately. The `permissions` table provides the catalog for the admin UI and the keys referenced by grants and rules. Migration `0003_elevated_grants.sql` creates the elevated grants table.

## Managing live roles and grants

Administrators manage current roles, user assignments, and grants through the shared Administration API. The seed command intentionally leaves these records alone so a deployment cannot erase administrator changes.

Adding a permission to the catalog makes it available for new grants. For existing installations, add role grants through Administration or a reviewed data migration. Fresh bootstrap applies the role templates. The local seed also provisions the templates for demo use.

Permission grant/removal and user role assignment mutations are audited by the API. Permission changes revoke sessions for affected users where the endpoint requires it; authorization itself reads current database grants rather than embedding grants in sessions.

## Adding a permission

1. Add its literal to `PERMISSION` and add a `{ key, description }` entry to `PERMISSION_CATALOG` in `packages/authorization/src/permissions.ts`.
2. Use the typed constant in the API's `@RequirePermission` decorator. For write actions that support elevation, register the key in `ELEVATED_PERMISSION_SCOPES`, use `@RequireActionPermission`, and invoke the `@ClaimPermission()` callback after input validation and before the action. Add the key to a module role template if fresh bootstrap should grant it to that role.
3. Deploy the package and run `pnpm --filter @project/db seed:permissions` after migrations.
4. Grant the permission to existing roles through Administration, or include a deliberate data migration if the rollout requires an automatic grant.

No schema migration is needed to add a permission key. The seed command is idempotent, so it is safe to rerun.

## Retiring a permission

The catalog seeder preserves existing rows. When retiring a permission, remove its API enforcement and update the application catalog. Review its role grants, ACL entries, and elevated grants before deleting the database row.

## Related implementation and setup

- [API authentication and authorization setup](../../auth-api-setup.md)
- [Administration dashboard](../../../apps/web/src/modules/admin/README.md#manage-elevated-grants)
- [Authorization catalog package](../../../packages/authorization/README.md)
- [HR API access and setup](../hr/API.md)
- [Facilities API access and setup](../facilities/API.md)
- [Inventory API access and setup](../inventory/API.md)
