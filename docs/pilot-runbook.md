# Pilot release and recovery

## Deploy the API and web app together

1. Record the current application release, migrations applied, and recovery checkpoint. Pause writes for the rehearsal or a coordinated rollout.
2. Back up PostgreSQL to a restricted location using `pg_dump -Fc`. Confirm that the archive can be read and record its timestamp.
3. Apply `pnpm --filter @project/db migrate` and then `pnpm --filter @project/db seed:permissions`. Synchronize the catalog before serving requests.
4. Deploy the paired API and web build. Set the public `VITE_API_URL` at web build time. Set `BETTER_AUTH_URL` and `TRUSTED_ORIGINS` to the deployed API and exact browser origins, respectively. Serve web deep links through the app entry point.
5. Check `GET /health/database`, open a Student Affairs deep link, and sign in. Verify that staff can read across years and edit only assigned years. Issue and revoke a dean grant and confirm that a subsequent move is denied. Check an Inventory operator’s access to the asset list and a staff account without Inventory permission.
6. Resume writes after the health and role checks pass. Investigate failed health checks, sustained API errors, or repeated authorization failures before widening the pilot.

## Rehearse an upgrade and restore

Start the configured loopback PostgreSQL container. If this checkout needs its initial browser setup, run `pnpm setup:playwright` while online. Then run the rehearsal from the repository root.

```sh
pnpm test:pilot --restore
```

The rehearsal uses the same local browser cache as the smoke tests. [Browser setup](../README.md#build-and-test-the-frontend)

The command uses `DATABASE_URL` or `packages/db/.env.db` to connect to the local server. It creates two new databases with generated names. The PostgreSQL account needs permission to create databases. The backup and restore use the container’s PostgreSQL tools. The runtime defaults to `podman` and the container to `faculty-postgres`. Override them with `PILOT_CONTAINER_RUNTIME` and `PILOT_PG_CONTAINER` when using a different local container. The rehearsal uses ports 4753 and 4754.

The harness loads a synthetic student, annual record, and asset at migration `0005`, verifies they survive the upgrade, then seeds the current demo accounts and runs the live browser journey. It restores a custom-format archive into a separate database and compares student profiles, annual history, staff assignments, promotion grants, Inventory records, and audit entries. It starts the API against that restored database and repeats health and role checks. The generated databases and temporary archive are removed at the end. CI also runs the live browser journey against a fresh disposable database.

The local PostgreSQL 17 rehearsal passed on November 22, 2026. Existing data survived the upgrade, the live browser journey passed, and restored records and audit history matched the source. The restored API passed its database health check and five role access checks.

## Recover after a failed rollout

Stop serving writes and preserve the failed environment for diagnosis. Roll back the API and web build as a pair. Keep an additive schema upgrade in place when the previous release passes a compatibility and role check. If the schema or data needs recovery, restore the verified checkpoint into a separate database first, review any writes made since the backup, then switch only after the health and role checks pass. Record the outcome before reopening writes.

## Workflow queue benchmark

The local benchmark compared the previous queue reader with paginated reads on identical synthetic Inventory approval data in PostgreSQL 17. Each measurement used one warm-up and five timed runs. Query counts cover the database calls during the list read. The benchmark traversed every page when comparing the same number of returned records.

| Rows  | Queue   | Previous p50 / p95   | Previous SQL queries | New first page p50 / p95 | First page SQL queries | New all pages p50 / p95 | All pages SQL queries |
| ----- | ------- | -------------------- | -------------------- | ------------------------ | ---------------------- | ----------------------- | --------------------- |
| 100   | Inbox   | 377.3 / 755.2 ms     | 401                  | 5.6 / 6.7 ms             | 5                      | 14.5 / 15.0 ms          | 20                    |
| 100   | Monitor | 31.7 / 35.1 ms       | 101                  | 5.0 / 7.3 ms             | 5                      | 17.0 / 18.2 ms          | 20                    |
| 1,000 | Inbox   | 2,297.7 / 4,097.2 ms | 4,001                | 19.3 / 25.9 ms           | 5                      | 313.5 / 450.1 ms        | 200                   |
| 1,000 | Monitor | 1,460.7 / 1,466.0 ms | 1,001                | 19.7 / 19.8 ms           | 5                      | 673.4 / 699.1 ms        | 200                   |

To repeat, build the baseline revision `23579e6` in a separate checkout. Build the current API, then copy the baseline's compiled `modules/workflows/workflows.service.js` into the current API's ignored build directory as `modules/workflows/workflows-baseline.js`. Run `node packages/db/test/workflow-queue-benchmark.mjs` from the current workspace. It creates and removes a disposable database. Both readers run on the upgraded schema so the comparison isolates the queue-reader changes.
