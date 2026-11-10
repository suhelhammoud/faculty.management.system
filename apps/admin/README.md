# Faculty administration

Standalone React/Vite app at http://localhost:3011, exposing `admin/App` through Module Federation. The shell includes an Administration tab.

## Run locally

1. Configure the API with `PORT=4000`, `BETTER_AUTH_URL=http://localhost:4000`, and `TRUSTED_ORIGINS=http://localhost:3011,http://localhost:3000` alongside the database URL and auth secret. Apply migrations and bootstrap an administrator as described in `docs/auth-api-setup.md`.
2. Copy `.env.example` to `.env` if changing the default API URL. Vite environment values are public build-time settings; never put secrets here.
3. Run `pnpm dev:api` and `pnpm dev:admin` from the workspace root. For federation, also run `pnpm dev:shell`.
4. Use the administrator username and temporary password, set a new password, and sign in again.

React Query owns sessions, API data, mutations, and invalidation. Zustand owns the selected dashboard tab and user; credentials are never persisted. Local shadcn/ui-style Button and Input source components use Radix Slot, CVA, and Tailwind; `components.json` and the `@` alias support extending the component collection. Tailwind preflight is omitted to avoid resetting sibling federated apps.

The dashboard supports account creation/approval/enable/disable/reset, role creation/deletion/assignment/removal, permission grants/removals, and resource ACL exceptions. Backend errors remain authoritative; denied requests show accessible error messages. Destructive actions require confirmation. The backend currently lacks role-assignment and role-permission listing endpoints, so removal uses catalog selectors and returns a not-found error if the selected relationship does not exist.

The API must allow both standalone and shell origins. Production remote URLs and the API URL must be configured for your deployment; local federation URLs follow the existing repository convention.

Validation: `pnpm --filter admin build` and `pnpm --filter shell build`. A live database/API is required for end-to-end authentication verification.

## Production URL configuration

Set `VITE_API_URL` to the API's public HTTPS origin before building the admin remote. Set `VITE_ADMIN_REMOTE_URL` in the shell build environment to the deployed admin app's `remoteEntry.js` URL. These are public build-time values, so changing them requires rebuilding the relevant frontend.

On the API, set `BETTER_AUTH_URL` to its public HTTPS origin and `TRUSTED_ORIGINS` to the exact comma-separated browser origins serving the shell and the standalone admin app. The same origins are used for credentialed CORS. Do not use wildcards. See `apps/api/.env.production.example` for a template; the example hostnames must be replaced with your deployed domains.
