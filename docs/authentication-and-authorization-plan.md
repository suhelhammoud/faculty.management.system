# Authentication and Authorization Implementation Plan

## Scope

Implement authentication and backend authorization in `apps/api` using Better Auth, NestJS, PostgreSQL, and the existing Drizzle database package in `packages/db`. Connect the React frontend after the backend endpoints are verified.

## Agreed requirements

- Username and password login using Better Auth's username plugin and cookie-based sessions.
- Administrator-created accounts only; disable public registration and email-based login and recovery.
- Define username validation, uniqueness, and case normalization consistently.
- Administrators manage account approval, role assignments, role permissions, and resource ACL exceptions through the admin dashboard.
- Support multiple roles per user.
- Enforce authorization in the backend on every protected endpoint, independently of frontend visibility.
- Email, if retained in the account schema, is not a login or recovery mechanism.

## Account lifecycle and password recovery

1. Bootstrap the first approved administrator through a controlled command that accepts credentials securely.
2. Administrators create accounts and assign roles. Proposed default: new accounts remain pending until explicitly approved.
3. Supply an initial temporary password through a separate channel and require the user to change it before accessing application features.
4. Password recovery occurs only through the admin dashboard and requires `users:reset-password`.
5. A reset issues a temporary password, revokes existing sessions, and marks the account as requiring a password change.
6. After login, users requiring a password change may access only the necessary password-change and logout endpoints. Account approval remains required for normal application access.
7. Audit account creation, approval, and password resets without recording passwords or session secrets. Do not persist plaintext temporary passwords.

Pending or disabled accounts cannot access protected application data. Document the narrowly scoped session and password-change endpoints separately from business endpoints.

## Database design

Add Drizzle schemas and migrations for:

- Better Auth users, sessions, accounts, and verification data as required by the selected configuration.
- User approval status, enabled/disabled status, and mandatory password-change state.
- `roles`: named roles with descriptions.
- `permissions`: unique action-and-resource permission keys, such as `users:read`, `users:create`, `users:approve`, `users:reset-password`, `roles:update`, and `tasks:update`.
- `user_roles`: many-to-many user-to-role assignments.
- `role_permissions`: many-to-many role-to-permission assignments.
- Resource ACL entries: user, resource type, resource ID, permission, and explicit `allow` or `deny` effect.
- Audit records for administrative account and authorization changes.

Add foreign keys, appropriate uniqueness constraints, and indexes for authorization lookups. Validate ACL resource references in the service layer where polymorphic resource IDs cannot use a database foreign key.

## Authorization precedence

For each requested action on a protected resource:

1. Require a valid session and an approved, enabled account.
2. Enforce mandatory password change before business access.
3. Deny if a matching explicit per-user resource ACL deny exists.
4. Otherwise, allow if a matching per-user resource ACL grant exists.
5. Otherwise, allow if any assigned role grants the required permission.
6. Otherwise, deny by default.

ACL matching includes user, permission, resource type, and resource ID. Resource-specific grants do not grant general access to unrelated resources. Administrator roles do not bypass explicit ACL denies or account restrictions.

Enforce resource access on individual endpoints, list results, and bulk operations. Permission changes must take effect without requiring a new login; avoid stale permission data embedded in sessions or invalidate authorization caches when assignments change.

## Implementation sequence

### 1. Database and configuration

- Verify compatible Better Auth, username plugin, and Drizzle adapter versions.
- Reuse the existing database provider and pool lifecycle.
- Add schemas, exports, migrations, and initial permission definitions.
- Validate auth secret, API base URL, and trusted frontend origins through configuration.
- Document migration and bootstrap commands; keep credentials out of committed files.

### 2. Authentication endpoints

- Add a NestJS auth module and mount the Better Auth handler under `/api/auth`.
- Enable username/password sign-in, session inspection, sign-out, and authenticated password changes.
- Disable public sign-up, email sign-in, and self-service email recovery on the server.
- Configure handler ordering and body parsing correctly.
- Configure secure HttpOnly cookies, credentialed CORS with explicit origins, trusted origins, and CSRF protection.
- Verify session revocation and mandatory password-change enforcement across all relevant auth endpoints.

### 3. Authorization enforcement

- Implement a shared authorization service and NestJS guards/decorators.
- Declare required permissions and resolve resource identifiers for protected routes.
- Apply the documented precedence consistently.
- Explicitly identify public authentication and health endpoints.
- Prevent privilege escalation through account, role, permission, or ACL management.
- Prevent administrative changes that remove the last usable administrator.

### 4. Administrator APIs

Provide protected endpoints for:

- Creating and viewing users, approving accounts, and enabling/disabling accounts.
- Assigning and removing user roles.
- Creating and editing roles and their permissions.
- Adding, listing, updating, and removing per-user resource ACL exceptions.
- Resetting passwords and revoking sessions.
- Reviewing administrative audit records with an appropriate permission.

Define endpoint contracts and permission requirements before frontend integration. Use transactions for related administrative writes and audit records where appropriate.

### 5. React integration

- Add username/password login using Better Auth's React client and username plugin support.
- Use browser cookies for sessions; do not store session credentials in localStorage.
- Add the mandatory password-change flow and account approval state.
- Add admin dashboard screens for users, approvals, roles, permissions, ACL exceptions, and password resets.
- Use permissions to improve frontend visibility and navigation while retaining backend enforcement.

### 6. Verification and documentation

- Test successful and failed username login, normalization, logout, and expired or revoked sessions.
- Verify public registration, email login, and email recovery are unavailable.
- Test pending/disabled account restrictions and required password changes.
- Test administrator password reset, session revocation, and subsequent password change.
- Test multiple-role permission aggregation and default-deny behavior.
- Test ACL deny over grant, ACL grant over absent role permissions, and resource isolation.
- Test list filtering and bulk-operation authorization.
- Test unauthorized administrative actions, privilege escalation attempts, and last-administrator protection.
- Run relevant API tests, integration tests against an isolated database, type checks, lint, and builds.
- Document endpoint contracts, configuration, migration steps, bootstrap, permission naming, authorization precedence, and administrator recovery procedures.

## Completion criteria

The backend is complete when migrations and administrator bootstrap work, username sessions operate correctly, admin-only account management and recovery are enforced, and automated tests demonstrate approval, RBAC, and ACL enforcement. React integration follows once these contracts are verified.

## Reference documentation

- [Better Auth NestJS integration](https://better-auth.com/docs/integrations/nestjs)
- [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)

This document is an implementation plan; it does not indicate that the described features are already implemented.
