# HR frontend

Open HR in the [faculty web app](http://localhost:3000/hr/employees).

## Run locally

1. Configure the API as described in [the HR API guide](../../../../../docs/modules/hr/API.md), apply migrations, and bootstrap an administrator if needed. Assign the **HR Administrator** role to the intended HR user using shared Administration.
2. Include `http://localhost:3000` in the API's `TRUSTED_ORIGINS`. See the [web app guide](../../../README.md) for the API URL setting.
3. Run the API and web app in separate terminals:

```sh
pnpm dev:api
pnpm dev
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

- The web app mounts HR at `/hr/*`. HR uses its parent router for nested routes.
- React Query owns API state, session checks, mutations, and invalidation. Queries are cancelled and personnel caches cleared when identity or account eligibility changes. Writes are never automatically retried.
- Zustand stores only the UI language. English/LTR is the default; users may choose Arabic/RTL. `faculty-hr-language` is the only persisted value; no credentials or personnel data are stored in local storage.
- A scoped react-i18next instance translates labels and messages. Reference names prefer the selected language and fall back to the available name. Stored employee names are displayed as entered.
- Official shadcn component sources live in `components/ui`, with minimal neutral styling. Tailwind utilities use the `hr:` prefix, global preflight is omitted, and local styles live under `.faculty-hr`. Generated components are adapted to the prefix and light theme. Apply the same adaptations when adding components later.
- Dialogs portal inside the HR root to inherit its theme and direction. Controls use logical spacing for RTL.
- The decorative employee portrait is a placeholder: replace `apps/web/public/images/employee-placeholder.svg` later. No image upload or storage API is included.

The first version covers employee details, current employment, and reference lists. Reports, employee deletion, account administration/linking, document uploads, requests, and employment-history editing are outside its scope.

## Verification

```sh
pnpm --filter web test src/modules/hr
pnpm build:web
pnpm --filter web lint
```

The test suite runs in jsdom with mocked API responses. It checks English/Arabic direction and persistence, authentication states, URL filters, profile creation, independent employment saves, dependent selectors, reference dialogs, and error recovery. It does not replace a live browser smoke test against the deployed web app and API.
