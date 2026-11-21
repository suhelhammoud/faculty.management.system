# Project overview

The Faculty Management System combines ten academic and administrative domains
in one university application. Administration and Workflows provide shared
tools across these domains.

## Architecture

| Workspace location       | Responsibility                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `apps/web`               | React, Vite, and TypeScript frontend with a module directory and one browser router |
| `apps/api`               | NestJS HTTP API with domain modules, Better Auth sessions, and authorization        |
| `packages/db`            | PostgreSQL schema, Drizzle migrations, and database access                          |
| `packages/authorization` | Typed permission catalog and default role templates                                 |
| `packages/contracts`     | Shared TypeScript contracts for workflows                                           |

Each frontend feature has its own folder under `apps/web/src/modules`. Shared
React form controls live in `apps/web/src/components/ui`. The web app lazy-loads
the domain and Administration entry points from a single build.
A shared browser router handles navigation and delegates nested routes to the
feature that owns them. Feature screens reuse the same API session, and NestJS
enforces access on protected endpoints. [Shared authorization](modules/authorization/README.md)

## Frontend routes

The root route `/` shows the faculty module directory. Each module opens on its
own page and links back to the directory through **All modules**. Existing
module paths and deep links use the web app's origin. Inventory selects its
default view based on the signed-in user's capabilities.

| Feature folder    | Entry route        | Example nested route                        |
| ----------------- | ------------------ | ------------------------------------------- |
| `admin`           | `/admin`           |                                             |
| `attendance`      | `/attendance`      |                                             |
| `maintenance`     | `/maintenance`     |                                             |
| `supervision`     | `/supervision`     |                                             |
| `meetings`        | `/meetings`        |                                             |
| `hr`              | `/hr`              | `/hr/employees`, `/hr/employees/new`        |
| `exams`           | `/exams`           |                                             |
| `correspondence`  | `/correspondence`  |                                             |
| `inventory`       | `/inventory`       | `/inventory/my-items`, `/inventory/assets`  |
| `student-affairs` | `/student-affairs` | `/student-affairs/students`                 |
| `facilities`      | `/facilities`      | `/facilities/rooms`, `/facilities/settings` |
| `workflows`       | `/workflow/tasks`  | `/workflow/tasks/:id`, `/workflow/monitor`  |

Attendance, Maintenance, Supervision, Meetings, Exams, and Correspondence
currently have placeholder screens. Their module specifications
describe the intended features. [Module specifications](README.md#module-specifications) · [Route definitions](../apps/web/src/App.tsx)

## Run and deploy

- Run `pnpm dev` or `pnpm dev:web` for the web app at `http://localhost:3000`.
  Run `pnpm dev:api` for the API at `http://localhost:4000` using the local
  environment examples.
- Set the frontend's public `VITE_API_URL` in `apps/web/.env` when the API origin
  differs from the local default. Include the web origin in the API's
  `TRUSTED_ORIGINS` so credentialed browser requests can use the shared session.
- Run `pnpm build:web` to generate `apps/web/dist`. `pnpm build:frontends` runs the
  same build. Serve that directory as static files and return `index.html` for
  client-side navigation paths such as `/hr/employees/new`. Serve assets directly
  and forward API requests to NestJS when both run behind the same reverse proxy.
- Run `pnpm --filter web test` for feature tests and `pnpm test:frontend:smoke`
  for browser tests against a production build. [Web setup and hosting](../apps/web/README.md) · [Test setup](../README.md#build-and-test-the-frontend)
