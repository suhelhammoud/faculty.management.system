# Auth API setup

Configure `DATABASE_URL` once in `packages/db/.env.db`. The API and database package load the shared value from there. Set a random `BETTER_AUTH_SECRET` of at least 32 characters in `apps/api/.env`.

For local development, set `PORT=4000`, `BETTER_AUTH_URL=http://localhost:4000`, and `TRUSTED_ORIGINS=http://localhost:3000` in `apps/api/.env`. Run `pnpm dev:api` and `pnpm dev` in separate terminals. The web app uses `http://localhost:4000` as its default `VITE_API_URL`. [API environment example](../apps/api/.env.example)

In production, use HTTPS. Set `BETTER_AUTH_URL` to the public API URL and include the exact origin serving `apps/web` in the API's comma-separated `TRUSTED_ORIGINS`. Set `VITE_API_URL` before building the frontend. Administration lives at `/admin` on the same web origin as the other modules. [Web deployment guide](../apps/web/README.md#build-and-host)

Run the database migrations with `pnpm --filter @project/db migrate`, synchronize the version-controlled permission catalog with `pnpm --filter @project/db seed:permissions`, then build with `pnpm --filter api build`. Migration `0003_elevated_grants.sql` adds the elevated grants table. Run the catalog seed after migrations on every deployment to insert missing keys and update their descriptions. [Shared authorization guide](modules/authorization/README.md)

For an empty user database, put `BOOTSTRAP_USERNAME` and `BOOTSTRAP_PASSWORD` in a temporary ignored file and run `node --env-file=packages/db/.env.db --env-file=apps/api/.env.bootstrap apps/api/dist/auth/bootstrap-admin.js`. The bootstrap administrator must change their password after signing in. Do not put passwords in shell history or commit them.

## Endpoints

All mutation requests must include an allowed `Origin` header. Browser requests must include cookies (`credentials: 'include'`). Public health routes are `/` and `/health/database`.

| Method | Path                                  | Body / purpose                                                          |
| ------ | ------------------------------------- | ----------------------------------------------------------------------- |
| POST   | `/api/auth/sign-in/username`          | `username`, `password`                                                  |
| GET    | `/api/auth/get-session`               | Current session                                                         |
| POST   | `/api/auth/sign-out`                  | Sign out                                                                |
| POST   | `/api/admin/change-password`          | `currentPassword`, `newPassword`; authenticated, enabled accounts only  |
| GET    | `/api/admin/users`                    | List users; `users:read`                                                |
| POST   | `/api/admin/users`                    | `username`, `name`, `password`; `users:create`                          |
| POST   | `/api/admin/users/:id/approve`        | `users:approve`                                                         |
| POST   | `/api/admin/users/:id/reset-password` | Temporary `password`; `users:reset-password`                            |
| GET    | `/api/admin/roles`                    | `roles:read`                                                            |
| POST   | `/api/admin/roles`                    | `name`; `roles:create`                                                  |
| POST   | `/api/admin/roles/:id/permissions`    | `permission`; `roles:update`                                            |
| GET    | `/api/admin/users/:id/roles`          | Assigned role IDs and names. Requires `users:assign-roles` on the user. |
| POST   | `/api/admin/users/:id/roles`          | `roleId`; `users:assign-roles`                                          |

New accounts are pending approval and require a password change. Passwords must be 12–128 characters. Username creation accepts 3–30 ASCII letters, digits, or underscores and normalizes to lowercase. Synthetic internal email identifiers satisfy Better Auth's schema; email login and recovery are not exposed.

Administrators supply temporary passwords through a separate channel. Password reset and password change revoke all existing sessions. Sign in again after changing a password. Pending users may change their password, but cannot access business endpoints until approved.

Admin actions require an approved, enabled account without a pending password change. A matching record-level deny takes precedence over ACL allows, role permissions, and elevated grants. A matching ACL allow or role permission grants access before elevation is considered. Unannotated Nest endpoints deny access by default. [Request authorization order](modules/authorization/README.md#how-the-api-checks-a-request)

Apply migrations explicitly before starting the API. The Administration dashboard calls the account and access management endpoints. [Administration guide](../apps/web/src/modules/admin/README.md)

## Account disabling and role removal

- `POST /api/admin/users/:id/disable` and `/enable`: require `users:approve` on the target user, including ACL checks. Enabling does not approve an account or clear its required password change.
- `DELETE /api/admin/users/:id/roles/:roleId`: requires `users:assign-roles` on the target user.
- `DELETE /api/admin/roles/:id`: requires `roles:update` on the role; removes its assignments and permission relationships through database cascades.

Disabling blocks new login sessions and revokes existing ones. Role removal revokes affected users' sessions. Changes are audited transactionally. Missing targets return 404.

Destructive operations preserve at least one approved, enabled user without a pending password change whose combined roles grant `users:create`, `users:approve`, `users:assign-roles`, and `roles:update`. They return 409 if this invariant would be violated. Serializable transactions prevent concurrent removals from both passing the check; a serialization conflict requires retrying the request. This definition concerns global role permissions, not resource-specific ACL exceptions.

## ACL and permission management

| Method | Path                                           | Authorization                                                                 |
| ------ | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| GET    | `/api/admin/permissions`                       | `roles:read`                                                                  |
| DELETE | `/api/admin/roles/:id/permissions/:permission` | `roles:update` on the role                                                    |
| GET    | `/api/admin/users/:id/acl`                     | `users:assign-roles` on the user                                              |
| POST   | `/api/admin/users/:id/acl`                     | `users:assign-roles` on the user plus the affected permission on the resource |
| DELETE | `/api/admin/users/:id/acl/:aclId`              | Same checks as ACL creation                                                   |

ACL creation accepts `resourceType`, `resourceId`, `permission`, and `effect` (`allow` or `deny`). Example: `{"resourceType":"users","resourceId":"TARGET_USER_ID","permission":"users:approve","effect":"deny"}`. The response contains the new ACL entry ID. Grants and denies may coexist; any matching deny wins. Delete a deny explicitly to restore access. Removing a deny requires the same delegation checks as adding a grant.

Registered ACL resource types are `users`, `roles`, and `inventory.removal-request`. Removal requests accept the review, committee decision, and committee withdrawal permissions. The permission catalog returns an `aclResourceType` for each key. A null value means the key has no registered ACL resource type. The API validates the permission and looks up the resource before saving a rule. The supported keys and descriptions live in `@project/authorization` and are synchronized with `pnpm --filter @project/db seed:permissions`.

Permission removal revokes affected sessions and applies the existing last-administrator invariant in a serializable transaction. ACL changes take effect on subsequent authorization checks without a new login, and all mutations write audit records. ACL listing is scoped to the user named in the URL; deleting another user's ACL ID returns 404. No schema migration is needed for these endpoints.

## Elevated grants

The `:id` in these routes identifies the user receiving the grant. All three endpoints require `users:assign-roles` on that user. The actor must also hold the affected permission at the requested scope to issue or revoke a grant. The API checks the actor’s existing role or ACL access for this purpose.

| Method | Path                                            | Response                                                        |
| ------ | ----------------------------------------------- | --------------------------------------------------------------- |
| GET    | `/api/admin/users/:id/elevated-grants`          | `200` with `{ grants, eligiblePermissions }`.                   |
| POST   | `/api/admin/users/:id/elevated-grants`          | `201` with the new grant.                                       |
| DELETE | `/api/admin/users/:id/elevated-grants/:grantId` | `200` with `{ success: true }`. Revocation records `revokedAt`. |

Each listed grant includes its deadline, remaining attempts, and revocation timestamp. Each eligible permission includes its `key`, `description`, and `resourceType`. A `null` resource type means the permission supports global grants only.

To issue a grant, send an eligible `permission` key, a future ISO 8601 `expiresAt` with a time zone, and a positive integer `maxUses`. Include `resourceId` for a grant limited to one user account or asset, according to the permission. The API derives the resource type from the permission. Omitting `resourceId` grants the permission at global scope. The following request grants one attempt to use `users:approve` on `TARGET_USER_ID`.

```json
{
  "permission": "users:approve",
  "resourceId": "TARGET_USER_ID",
  "expiresAt": "2030-07-15T17:00:00Z",
  "maxUses": 1
}
```

At an eligible endpoint, the API claims a grant attempt after input validation and before running the action. A failed action still spends the attempt. Existing role or ACL access and read-only checks leave the counter intact. Expired, exhausted, or revoked grants cannot authorize a request. [Supported permissions and scopes](modules/authorization/README.md#elevated-grants)

## Audit log

`GET /api/admin/audit-log` requires `audit:read` and returns `{ records, page, pageSize, total }`, newest first. It defaults to 25 records per page and accepts up to 100. Filter by actor ID with `actor`, event name with `action`, or date range with `from` and `to`. The Administration dashboard’s **Audit log** tab uses this endpoint. Bootstrap grants `audit:read` to Administrator.

Elevated access records `elevated-grants:issue`, `elevated-grants:use`, and `elevated-grants:revoke` events. A use event records the claimed attempt, including when the protected action subsequently fails.
