# Faculty administration

Standalone React/Vite app at http://localhost:3011, exposing `admin/App` through Module Federation. The shell includes an Administration tab.

## Run locally

1. Configure the API with `PORT=4000`, `BETTER_AUTH_URL=http://localhost:4000`, `TRUSTED_ORIGINS=http://localhost:3011,http://localhost:3000`, and its auth secret. Set the shared database connection string in `packages/db/.env.db`, apply migrations, and provision an administrator. [API setup](../../docs/auth-api-setup.md) · [Local demo setup](../../README.md#configure-migrate-and-seed)
2. Copy `.env.example` to `.env` if changing the default API URL. Vite environment values are public build-time settings; never put secrets here.
3. Run `pnpm dev:api` and `pnpm dev:admin` from the workspace root. For federation, also run `pnpm dev:shell`.
4. Use the administrator username and temporary password, set a new password, and sign in again.

React Query owns sessions, API data, mutations, and invalidation. Zustand owns the selected dashboard tab and user; credentials are never persisted. Local shadcn/ui-style Button and Input source components use Radix Slot, CVA, and Tailwind; `components.json` and the `@` alias support extending the component collection. Tailwind preflight is omitted to avoid resetting sibling federated apps.

The dashboard supports account creation, approval, enablement, disabling, and password resets. It also manages roles, role permissions, resource access rules, and elevated grants. The API enforces access and the dashboard displays its errors. Destructive actions require confirmation.

The API must allow both standalone and shell origins. Production remote URLs and the API URL must be configured for your deployment; local federation URLs follow the existing repository convention.

Validation: `pnpm --filter admin build` and `pnpm --filter shell build`. A live database/API is required for end-to-end authentication verification.

## Manage elevated grants

1. Open **Resource access** and select the user receiving the grant.
2. In **Issue elevated grant**, choose one permission. Select a target account or enter an asset ID when the permission offers record scope. An empty target gives the grant global scope.
3. Set **Expires at (local time)** and **Maximum attempts**, then submit the form.
4. In **Elevated grants**, check the scope, expiry, remaining attempts, and status. Use **Revoke** to end an active grant early.

An authorized submission that uses the grant spends one attempt, even if the action fails. Read access to navigate a module continues to follow its standard permission checks. For a local example, sign in as `admin` and select `elevation_demo` under **Resource access**. [Demo fixtures](../../packages/db/src/seed/README.md#elevated-access-demo) · [How permissions are checked](../../docs/modules/authorization/README.md#how-the-api-checks-a-request)

## Production URL configuration

Set `VITE_API_URL` to the API's public HTTPS origin before building the admin remote. Set `VITE_ADMIN_REMOTE_URL` in the shell build environment to the deployed admin app's `remoteEntry.js` URL. These are public build-time values, so changing them requires rebuilding the relevant frontend.

On the API, set `BETTER_AUTH_URL` to its public HTTPS origin and `TRUSTED_ORIGINS` to the exact comma-separated browser origins serving the shell and the standalone admin app. The same origins are used for credentialed CORS. Do not use wildcards. See `apps/api/.env.production.example` for a template; the example hostnames must be replaced with your deployed domains.
