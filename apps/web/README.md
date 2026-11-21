# Faculty web app

Run `pnpm dev` at the repository root and open [localhost:3000](http://localhost:3000).
Run `pnpm dev:api` in a second terminal for features that use the API.
See the [workspace setup guide](../../README.md) for the database, development
accounts, and module routes.

The app uses one React Router and lazy-loads feature routes from `src/modules/`.
Each feature keeps its routes, components, styles, and tests in its own folder.
The directory at `/` lists every module. Module routes such as `/inventory`
and `/hr` open on their own pages, with an **All modules** link to the directory.
Copy `.env.example` to `.env` in this folder if you need to change the public
`VITE_API_URL`. The local default is `http://localhost:4000`.

Use the shared colors, spacing, and typography in `src/theme.css` when styling
a feature. `src/utility-theme.css` maps those colors to Tailwind utilities.
Use the `@project/ui` form primitives and the shared module header and navigation
styles for new screens. Verify controls at phone widths in both English and Arabic.

## Build and host

Run `pnpm build:web` from the workspace root and deploy `apps/web/dist`.
Set `VITE_API_URL` at build time to the public HTTPS API origin. Add the exact
web origin to the API's `TRUSTED_ORIGINS`. Use a same-site deployment or a reverse
proxy so the browser can send the API session cookie.

Serve static files directly and fall back to `index.html` for page navigations,
including nested routes such as `/hr/employees/new`. Return a 404 for missing
assets and route API requests to NestJS if hosting both behind a reverse proxy.
