# Faculty administration

Open Administration in the [faculty web app](http://localhost:3000/admin).

## Run locally

1. Configure the API with `PORT=4000`, `BETTER_AUTH_URL=http://localhost:4000`, `TRUSTED_ORIGINS=http://localhost:3000`, and its auth secret. Set the shared database connection string in `packages/db/.env.db`, apply migrations, and provision an administrator. [API setup](../../../../../docs/auth-api-setup.md) · [Local demo setup](../../../../../README.md#configure-migrate-and-seed)
2. Configure `VITE_API_URL` in [the web app](../../../README.md) if you use a different API origin.
3. Run `pnpm dev:api` and `pnpm dev` in separate terminals from the workspace root.
4. Use the administrator username and temporary password, set a new password, and sign in again.

React Query owns sessions, API data, mutations, and invalidation. Zustand owns the selected dashboard tab and user; credentials are never persisted. Local shadcn/ui-style Button and Input source components use Radix Slot, CVA, and Tailwind; `components.json` records the style configuration for those components. The module omits Tailwind preflight so it can share the page with other modules.

The dashboard supports account creation, approval, enablement, disabling, and password resets. It also manages roles, role permissions, resource access rules, and elevated grants. The API enforces access and the dashboard displays its errors. Destructive actions require confirmation.

Validate the build with `pnpm build:web`. A live database/API is required for end-to-end authentication verification.

## Manage elevated grants

1. Open **Resource access** and select the user receiving the grant.
2. In **Issue elevated grant**, choose one permission. Select a target account or enter an asset ID when the permission offers record scope. An empty target gives the grant global scope.
3. Set **Expires at (local time)** and **Maximum attempts**, then submit the form.
4. In **Elevated grants**, check the scope, expiry, remaining attempts, and status. Use **Revoke** to end an active grant early.

An authorized submission that uses the grant spends one attempt, even if the action fails. Read access to navigate a module continues to follow its standard permission checks. For a local example, sign in as `admin` and select `elevation_demo` under **Resource access**. [Demo fixtures](../../../../../packages/db/src/seed/README.md#elevated-access-demo) · [How permissions are checked](../../../../../docs/modules/authorization/README.md#how-the-api-checks-a-request)

## Faculty positions

Open **Faculty Positions** and choose **Assign holder** or **Manage holder** on the position row. The appointment form and history open below the row. Choose an approved, enabled user, confirm the **Appointment date**, and click **Save holder**. The date defaults to today and the holder changes as soon as you save. To end an appointment, choose **Vacant** and save. Users with read-only access can open the history with **View details**.

After the database migration and permission catalog sync, grant `faculty-positions:read` to existing roles that need to view the tab. Also grant `faculty-positions:manage` to roles that manage positions and appointments. New Administrator accounts provisioned with the default role template receive both permissions.

For workflows configured to use a position, pending approvals follow the incoming holder after a replacement if that user can see the record and meets the step rules. A vacant position leaves a position-only approval pending. [Position-based approval rules](../../../../../docs/modules/workflows/IMPLEMENTATION-PLAN.md#position-based-approval-steps)

## Production URL configuration

Follow the [web deployment guide](../../../README.md#build-and-host). On the API, set `BETTER_AUTH_URL` to its public HTTPS origin and include the exact web origin in `TRUSTED_ORIGINS`. The API uses the same allowlist for credentialed CORS and administrative requests.
