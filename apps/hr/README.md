# HR frontend

React/Vite HR administration app at `http://localhost:3005/hr/employees`, also exposed as `hr/App` through Module Federation. The shell hosts it at `http://localhost:3000/hr/employees`.

## Run locally

1. Configure the API as described in [the HR API guide](../../docs/modules/hr/API.md), apply migrations, and bootstrap an administrator if needed. Assign the **HR Administrator** role to the intended HR user using shared Administration.
2. Set the API's `PORT=4000` and `BETTER_AUTH_URL=http://localhost:4000`. Include both `http://localhost:3005` and `http://localhost:3000` in `TRUSTED_ORIGINS`, along with the Administration origin when used. Origins must match exactly; use `localhost` consistently rather than mixing it with `127.0.0.1`.
3. Copy `.env.example` to `.env` if changing `VITE_API_URL`. This is a public build-time value; never place credentials in Vite variables.
4. Run the API, HR, and (optionally) shell in separate terminals:

```sh
pnpm dev:api
pnpm dev:hr
pnpm dev:shell
```

Sign in within HR using the shared username and password. HR handles required password changes and account approval restrictions. It reuses the same API session cookies as Administration. Backend permissions remain authoritative; the frontend does not grant access.

## Screens

| Route                            | Purpose                                               |
| -------------------------------- | ----------------------------------------------------- |
| `/hr/employees`                  | Employee search, filters, and pagination              |
| `/hr/employees/new`              | Create a profile without requiring employment details |
| `/hr/employees/:employeeId`      | Personnel details and current employment              |
| `/hr/employees/:employeeId/edit` | Separate personal and employment forms                |
| `/hr/settings/:kind`             | Reference lists and create/edit dialogs               |

Settings supports `staff-categories`, `positions`, `academic-ranks`, `grade-schemes`, and `employment-grades`. Create category/position reference records before entering employment. Search/filter/page parameters live in the URL, and applying filters resets the page to 1. Optional fields are cleared using `null`, and employment saves send the complete current form because the API uses PUT replacement semantics.

## Architecture and appearance

- The shell owns one `BrowserRouter`; the exported HR app uses its parent route context. The standalone entry point wraps it at `/hr/*`. Shell and HR share `react-router` as a singleton.
- React Query owns API state, session checks, mutations, and invalidation. Queries are cancelled and personnel caches cleared when identity or account eligibility changes. Writes are never automatically retried.
- Zustand stores only the UI language. English/LTR is the default; users may choose Arabic/RTL. `faculty-hr-language` is the only persisted value; no credentials or personnel data are stored in local storage.
- A scoped react-i18next instance translates labels and messages. Reference names prefer the selected language and fall back to the available name. Stored employee names are displayed as entered.
- Official shadcn component sources live in `src/components/ui`, with minimal neutral styling. Tailwind utilities use the `hr:` prefix, global preflight is omitted, and local styles live under `.faculty-hr`. Generated components are adapted to the prefix and light theme. Apply the same adaptations when adding components later.
- Dialogs portal inside the HR root to inherit its theme and direction. Controls use logical spacing for RTL.
- The decorative employee portrait is a placeholder: replace `public/images/employee-placeholder.svg` later. No image upload or storage API is included.

The first version covers employee details, current employment, and reference lists. Reports, employee deletion, account administration/linking, document uploads, requests, and employment-history editing are outside its scope.

## Hosting

Set `VITE_API_URL` before building HR and `VITE_HR_REMOTE_URL` before building the shell. The latter points to HR's deployed `remoteEntry.js`; it defaults to the local HR origin. Allow both frontend origins in the API's trusted-origin configuration. API cookies must be usable from those origins; use an appropriate same-site deployment or reverse proxy.

The shell and standalone HR host both need SPA fallback routing: serve their `index.html` for navigation requests such as `/hr/employees/new`. Serve actual static files, federation entries, and assets directly; do not rewrite missing JS/CSS requests to HTML. Keep each remote's assets accessible at its configured origin. The standalone root redirects to `/hr/employees`; the shell root redirects to `/attendance`.

## Verification

```sh
pnpm --filter hr test
pnpm --filter hr build
pnpm --filter hr lint
pnpm --filter shell build
pnpm --filter shell lint
```

The test suite runs in jsdom with mocked API responses. It checks English/Arabic direction and persistence, authentication states, URL filters, profile creation, independent employment saves, dependent selectors, reference dialogs, and error recovery. It does not replace a live browser smoke test against the deployed API and federation setup.
