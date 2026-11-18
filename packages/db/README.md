# Local PostgreSQL database

The local PostgreSQL instance runs in the `faculty-postgres` Podman container. It can hold multiple databases; the apps connect to the database named in `DATABASE_URL`.

## Create a second database

Start the existing container if it is stopped:

```sh
pnpm --filter @project/db db:start
```

Create `faculty_db_02`. This leaves the existing `faculty_db` database and its data untouched:

```sh
podman exec faculty-postgres createdb -U faculty --owner=faculty faculty_db_02
```

Set the same URL in `packages/db/.env` and `apps/api/.env` so both packages use the new database:

```dotenv
DATABASE_URL=postgresql://faculty:faculty_dev_password@127.0.0.1:5432/faculty_db_02
```

Apply all database migrations, synchronize the shared permission catalog, and build the API:

```sh
pnpm --filter @project/db migrate
pnpm --filter @project/db seed:permissions
pnpm --filter api build
```

Bootstrap a new administrator for `faculty_db_02` while its `users` table is empty. Put `DATABASE_URL`, `BOOTSTRAP_USERNAME`, and `BOOTSTRAP_PASSWORD` in the ignored temporary file `apps/api/.env.bootstrap`, then run:

```sh
node --env-file=apps/api/.env.bootstrap apps/api/dist/auth/bootstrap-admin.js
```

Remove the temporary bootstrap file after creating the account. To add synthetic local users, HR records, and Facilities rooms, set `SEED_USER_PASSWORD` in `packages/db/.env` and run:

```sh
pnpm --filter @project/db seed:local
```

## Reset a database

**This permanently deletes the selected database and all of its data.** Stop the API first. For example, to reset only `faculty_db_02` while keeping `faculty_db`, run:

```sh
podman exec faculty-postgres dropdb -U faculty --maintenance-db=postgres --force faculty_db_02
podman exec faculty-postgres createdb -U faculty --owner=faculty faculty_db_02
```

Then rerun the migrations and permission seed above. Do not run `dropdb` against `faculty_db` unless you intend to erase that database.
