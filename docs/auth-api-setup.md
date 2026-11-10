# Auth API setup

Configure `DATABASE_URL`, `BETTER_AUTH_SECRET` (random, at least 32 characters), `BETTER_AUTH_URL`, and comma-separated `TRUSTED_ORIGINS` using `apps/api/.env.example` as a reference. Use HTTPS in production.

Run the database migrations with `pnpm --filter @project/db migrate`, then build with `pnpm --filter api build`.

For an empty user database, run `node apps/api/dist/auth/bootstrap-admin.js` with `DATABASE_URL`, `BOOTSTRAP_USERNAME`, and `BOOTSTRAP_PASSWORD` injected securely into the environment. The bootstrap administrator must change their password after signing in. Do not put passwords in shell history or commit them.

## Endpoints

All mutation requests must include an allowed `Origin` header. Browser requests must include cookies (`credentials: 'include'`). Public health routes are `/` and `/health/database`.

| Method | Path | Body / purpose |
| --- | --- | --- |
| POST | `/api/auth/sign-in/username` | `username`, `password` |
| GET | `/api/auth/get-session` | Current session |
| POST | `/api/auth/sign-out` | Sign out |
| POST | `/api/admin/change-password` | `currentPassword`, `newPassword`; authenticated, enabled accounts only |
| GET | `/api/admin/users` | List users; `users:read` |
| POST | `/api/admin/users` | `username`, `name`, `password`; `users:create` |
| POST | `/api/admin/users/:id/approve` | `users:approve` |
| POST | `/api/admin/users/:id/reset-password` | Temporary `password`; `users:reset-password` |
| GET | `/api/admin/roles` | `roles:read` |
| POST | `/api/admin/roles` | `name`; `roles:create` |
| POST | `/api/admin/roles/:id/permissions` | `permission`; `roles:update` |
| POST | `/api/admin/users/:id/roles` | `roleId`; `users:assign-roles` |

New accounts are pending approval and require a password change. Passwords must be 12–128 characters. Username creation accepts 3–30 ASCII letters, digits, or underscores and normalizes to lowercase. Synthetic internal email identifiers satisfy Better Auth's schema; email login and recovery are not exposed.

Administrators supply temporary passwords through a separate channel. Password reset and password change revoke all existing sessions. Sign in again after changing a password. Pending users may change their password, but cannot access business endpoints until approved.

Admin actions require an approved, enabled account without a pending password change. Resource ACL deny takes precedence over grant, followed by role permissions. Unannotated Nest endpoints deny access by default. Delegation requires the actor to hold every permission being granted.

Dashboard UI is not implemented here. Database migrations are generated, not automatically applied at startup.

## Account disabling and role removal

- `POST /api/admin/users/:id/disable` and `/enable`: require `users:approve` on the target user, including ACL checks. Enabling does not approve an account or clear its required password change.
- `DELETE /api/admin/users/:id/roles/:roleId`: requires `users:assign-roles` on the target user.
- `DELETE /api/admin/roles/:id`: requires `roles:update` on the role; removes its assignments and permission relationships through database cascades.

Disabling blocks new login sessions and revokes existing ones. Role removal revokes affected users' sessions. Changes are audited transactionally. Missing targets return 404.

Destructive operations preserve at least one approved, enabled user without a pending password change whose combined roles grant `users:create`, `users:approve`, `users:assign-roles`, and `roles:update`. They return 409 if this invariant would be violated. Serializable transactions prevent concurrent removals from both passing the check; a serialization conflict requires retrying the request. This definition concerns global role permissions, not resource-specific ACL exceptions.

## ACL and permission management

| Method | Path | Authorization |
| --- | --- | --- |
| GET | `/api/admin/permissions` | `roles:read` |
| DELETE | `/api/admin/roles/:id/permissions/:permission` | `roles:update` on the role |
| GET | `/api/admin/users/:id/acl` | `users:assign-roles` on the user |
| POST | `/api/admin/users/:id/acl` | `users:assign-roles` on the user plus the affected permission on the resource |
| DELETE | `/api/admin/users/:id/acl/:aclId` | Same checks as ACL creation |

ACL creation accepts `resourceType`, `resourceId`, `permission`, and `effect` (`allow` or `deny`). Example: `{"resourceType":"users","resourceId":"TARGET_USER_ID","permission":"users:approve","effect":"deny"}`. The response contains the new ACL entry ID. Grants and denies may coexist; any matching deny wins. Delete a deny explicitly to restore access. Removing a deny requires the same delegation checks as adding a grant.

Currently registered resource types are `users` and `roles`, matching the backend's existing entities. Unknown types, missing resources, unknown permission keys, and mismatched permission namespaces are rejected. Register a resolver when introducing another resource such as tasks. Permissions are listed from the database catalog; this API does not create arbitrary permission keys.

Permission removal revokes affected sessions and applies the existing last-administrator invariant in a serializable transaction. ACL changes take effect on subsequent authorization checks without a new login, and all mutations write audit records. ACL listing is scoped to the user named in the URL; deleting another user's ACL ID returns 404. No schema migration is needed for these endpoints.

## Audit log

`GET /api/admin/audit-log` requires the `audit:read` permission and returns up to 200 newest records with actor name/username, action, target, and timestamp. Passwords and session tokens are never included. The admin dashboard's **Audit log** tab uses this endpoint; access is enforced by the API. Existing installations must add `audit:read` to the permissions catalog and grant it to an authorized role through a migration or administrative database operation.
