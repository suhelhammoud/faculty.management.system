# Faculty Management System

Monorepo for the Faculty Management System: a NestJS API, PostgreSQL database, and one React web app with feature modules.

## Prerequisites

- Node.js 22.23.3 (tested version)
- pnpm 12.18.0
- Podman

Install workspace dependencies once:

```sh
pnpm install
```

## Start PostgreSQL

The project uses the [official PostgreSQL container image](https://hub.docker.com/_/postgres) and Podman. For first-time setup, create the local container and persistent data volume:

```sh
podman run -d \
  --name faculty-postgres \
  -e POSTGRES_USER=faculty \
  -e POSTGRES_PASSWORD=faculty_dev_password \
  -e POSTGRES_DB=faculty_db \
  -p 127.0.0.1:5432:5432 \
  -v faculty-postgres-data:/var/lib/postgresql/data \
  docker.io/library/postgres:17
```

The database is exposed only on the local machine. To start the existing container later:

```sh
pnpm --filter @project/db db:start
podman exec faculty-postgres pg_isready -U faculty -d faculty_db
```

Stop it when finished with `pnpm --filter @project/db db:stop`. The named volume preserves database data across container stops. See the [Podman documentation](https://podman.io/docs) for container setup and management.

## Configure, migrate, and seed

1. On first setup, copy the examples to ignored local environment files. If a local `.env` already exists, edit it instead of overwriting it. Move any existing `DATABASE_URL` into `packages/db/.env.db` and remove its copies from the other files:

   ```sh
   cp packages/db/.env.db.example packages/db/.env.db
   cp packages/db/.env.example packages/db/.env
   cp apps/api/.env.example apps/api/.env
   ```

2. In `packages/db/.env.db`, set `DATABASE_URL` to the local connection string; both the API and database package load it from this shared file. In `packages/db/.env`, set `SEED_USER_PASSWORD` to a 12–128 character password for synthetic demo accounts. In `apps/api/.env`, keep `PORT=4000` and `BETTER_AUTH_URL=http://localhost:4000`, and replace the auth secret with a random value of at least 32 characters. For example, generate one with `openssl rand -base64 32`.

3. Set `TRUSTED_ORIGINS` in `apps/api/.env` to the exact local browser origins used during development:

   ```dotenv
   TRUSTED_ORIGINS=http://localhost:3000
   ```

   Keep the hostname consistent: `localhost` and `127.0.0.1` are different browser origins.

4. Apply the committed migrations and synchronize the permission catalog.

   ```sh
   pnpm --filter @project/db migrate
   pnpm --filter @project/db seed:permissions
   ```

   Migration `0003_elevated_grants.sql` adds storage for direct, time- and attempt-limited permission grants. The permission seed synchronizes the catalog. [How permissions work](docs/modules/authorization/README.md)

5. Load the local administrator, synthetic users, and application records:

   ```sh
   pnpm --filter @project/db seed:local
   ```

   Sign in with username `admin` and the `SEED_USER_PASSWORD` configured in `packages/db/.env`. The local administrator has all catalog permissions. Rerunning the seed preserves this administrator's password and account settings; other demo users use the current seed password.

   Local seeding synchronizes the permission catalog, creates the Administrator, HR Administrator, and Facilities Administrator roles, and adds their default permission grants without removing existing grants. It also seeds local Inventory roles and users, HR data, Facilities rooms, and Inventory opening transactions. The runner only accepts a non-production PostgreSQL database on a loopback host. See [local seed details](packages/db/src/seed/README.md).

   The `elevation_demo` account receives two direct grants that expire 24 hours after first seeding. Reruns preserve their expiry, remaining attempts, and revocation state. [Try the elevated-access demo](packages/db/src/seed/README.md#elevated-access-demo)

   For deployments without demo data, create the first administrator using the separate [bootstrap procedure](docs/auth-api-setup.md). Bootstrap requires an empty user table; local development does not require it.

## Run the API and web app

Start the API in one terminal:

```sh
pnpm dev:api
```

Start the frontend in another terminal:

```sh
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The app opens on Attendance.
Each feature lives in its own folder under `apps/web/src/modules`.

| Feature         | Route               |
| --------------- | ------------------- |
| Administration  | `/admin`            |
| Attendance      | `/attendance`       |
| Maintenance     | `/maintenance`      |
| Supervision     | `/supervision`      |
| Meetings        | `/meetings`         |
| HR              | `/hr/employees`     |
| Exams           | `/exams`            |
| Correspondence  | `/correspondence`   |
| Inventory       | `/inventory`        |
| Student Affairs | `/student-affairs`  |
| Facilities      | `/facilities/rooms` |
| Workflows       | `/workflow/tasks`   |

## Build and test the frontend

`pnpm build:web` builds the frontend into `apps/web/dist`.
Set `VITE_API_URL` before building when the app uses an API origin other than
`http://localhost:4000`. For production setup and deep-link routing, see
[the web app guide](apps/web/README.md).

Run the frontend tests with mocked API responses:

```sh
pnpm --filter web test
pnpm exec playwright install chromium
pnpm test:frontend:smoke
```

Use the `frontend` pnpm catalog when adding an existing shared dependency to another frontend. For new API-backed screens, use TanStack Query for fetching, caching, and mutations. Use Zustand for shared client state such as language preferences.

## More documentation

- [API setup and authentication](docs/auth-api-setup.md)
- [HR frontend](apps/web/src/modules/hr/README.md) and [HR module docs](docs/modules/hr/README.md)
- [Facilities frontend](apps/web/src/modules/facilities/README.md) and [Facilities module docs](docs/modules/facilities/README.md)
- [Administration frontend](apps/web/src/modules/admin/README.md)
- [All module documentation](docs/README.md)
