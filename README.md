# Faculty Management System

Monorepo for the Faculty Management System: a NestJS API, PostgreSQL database, a React shell, and independently runnable frontend apps.

## Prerequisites

- Node.js 22 or newer
- pnpm 12
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
   TRUSTED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004,http://localhost:3005,http://localhost:3006,http://localhost:3007,http://localhost:3008,http://localhost:3009,http://localhost:3010,http://localhost:3011
   ```

   Keep the hostname consistent: `localhost` and `127.0.0.1` are different browser origins.

4. Apply all committed database migrations:

   ```sh
   pnpm --filter @project/db generate
   pnpm --filter @project/db migrate
   pnpm --filter @project/db seed:permissions
   ```

   Migrations create the tables for the implemented modules; the permission seed registers the shared, version-controlled permission catalog without changing role grants.

5. Load the local administrator, synthetic users, and application records:

   ```sh
   pnpm --filter @project/db seed:local
   ```

   Sign in with username `admin` and the `SEED_USER_PASSWORD` configured in `packages/db/.env`. The local administrator has all catalog permissions. Rerunning the seed preserves this administrator's password and account settings; other demo users use the current seed password.

   Local seeding synchronizes the permission catalog, creates the Administrator, HR Administrator, and Facilities Administrator roles, and adds their default permission grants without removing existing grants. It also seeds local Inventory roles and users, HR data, Facilities rooms, and Inventory opening transactions. The runner only accepts a non-production PostgreSQL database on a loopback host. See [local seed details](packages/db/src/seed/README.md).

   For deployments without demo data, create the first administrator using the separate [bootstrap procedure](docs/auth-api-setup.md). Bootstrap requires an empty user table; local development does not require it.

## Run the API and apps

Run the API in one terminal:

```sh
pnpm dev:api
```

Run the shell and all frontend apps in another terminal:

```sh
pnpm dev
```

The shell runs at `http://localhost:3000` and opens on Attendance. It loads all module remotes, so their dev servers must be running. `pnpm dev` starts every frontend workspace in parallel; the API is separate.

| App             | Standalone dev URL                       | Shell route         | Focused command            |
| --------------- | ---------------------------------------- | ------------------- | -------------------------- |
| Administration  | <http://localhost:3011>                  | `/admin`            | `pnpm dev:admin`           |
| Attendance      | <http://localhost:3001>                  | `/attendance`       | `pnpm dev:attendance`      |
| Maintenance     | <http://localhost:3002>                  | `/maintenance`      | `pnpm dev:maintenance`     |
| Supervision     | <http://localhost:3003>                  | `/supervision`      | `pnpm dev:supervision`     |
| Meetings        | <http://localhost:3004>                  | `/meetings`         | `pnpm dev:meetings`        |
| HR              | <http://localhost:3005/hr/employees>     | `/hr/employees`     | `pnpm dev:hr`              |
| Exams           | <http://localhost:3006>                  | `/exams`            | `pnpm dev:exams`           |
| Correspondence  | <http://localhost:3007>                  | `/correspondence`   | `pnpm dev:correspondence`  |
| Inventory       | <http://localhost:3008/inventory>        | `/inventory`        | `pnpm dev:inventory`       |
| Student Affairs | <http://localhost:3009>                  | `/student-affairs`  | `pnpm dev:student-affairs` |
| Facilities      | <http://localhost:3010/facilities/rooms> | `/facilities/rooms` | `pnpm dev:facilities`      |

Use either `pnpm dev` for the full frontend suite or a focused command for a standalone app. Do not start both for the same app at once; Vite uses strict, fixed local ports.

## More documentation

- [API setup and authentication](docs/auth-api-setup.md)
- [HR frontend](apps/hr/README.md) and [HR module docs](docs/modules/hr/README.md)
- [Facilities frontend](apps/facilities/README.md) and [Facilities module docs](docs/modules/facilities/README.md)
- [Administration frontend](apps/admin/README.md)
- [All module documentation](docs/README.md)
