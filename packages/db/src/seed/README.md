# Local seed fixtures

These committed fixtures contain synthetic demo users and HR, Facilities, and Inventory records. They are
loaded by `pnpm --filter @project/db seed:local` after the database migrations have been
applied. No separate administrator bootstrap is needed.

The runner first synchronizes the permission catalog and provisions the
Administrator, HR Administrator, and Facilities Administrator roles with their
default grants. Reruns add missing default grants and preserve other grants.
It creates a local administrator with username `admin` and the configured
`SEED_USER_PASSWORD`, with all catalog permissions. Existing seeded administrator
credentials and account settings are preserved on reruns. If an existing account conflicts with a seeded username, user ID, email, or credential identity, seeding stops instead of modifying that account.
The local administrator is enabled and approved and does not require a password
change. Use the separate administrator bootstrap for deployments without demo data.

User roles are declared in `fixtures/local/auth.ts`: `HR_DEFAULT_ROLE.id` grants the HR Administrator
role and `FACILITIES_DEFAULT_ROLE.id` grants the Facilities Administrator role.
Allowed fixture role IDs are derived from the shared default role templates. The
`facility_1` demo account has Facilities permissions for managing facilities, and
does not receive HR permissions. Re-running the seed reconciles these two seeded
roles for the original demo users. Inventory demo users reconcile their Inventory roles separately.

HR staff categories and initial academic ranks follow the examples in the HR
documentation. Positions and the grade scheme are labeled as demo data because
the documentation does not define institution-specific position or pay-scale
records.

Fixture data is defined in typed TypeScript modules under `fixtures/local/`, separate from database operations. `types.ts` defines their shapes; each data export uses `satisfies` to check its structure. HR reference data and employees have separate files. Passwords stay in environment variables.

Seed operations are grouped by module under `modules/hr/`, `modules/facilities/`, and
`modules/inventory/`. Auth, account ownership, and permission setup live under
`access/`. The `local.ts` and `permission-catalog.ts` command entry points load
environment settings. The local runner in `run-local.ts` validates fixtures before
opening a transaction, checks account ownership, and runs seeders after their
prerequisites. Each module keeps its fixture rules in its own `validation.ts`. The root
`validation.ts` coordinates fixture preflight. The seeders share the transaction
type in `types.ts`.

`fixtures/local/facilities.ts` seeds one placeholder building, two floors, and the supplied
12 labs, 6 classrooms, and 6 theaters. Labs are assigned six per floor as
specified. Since floor locations were not provided for classrooms and theaters,
their numbers 7–9 and 1–3 are assigned to floor 1; 10–12 and 4–6 are assigned
to floor 2. Replace the placeholder building code/title with the institution's
actual building details when available. Room capacities remain unset because
none were provided.

From the repository root, run `pnpm --filter @project/db seed:local`. The command builds the seeders and fixtures into `dist`; it does not read external JSON files.

Set `DATABASE_URL` in the ignored `packages/db/.env.db` file and
`SEED_USER_PASSWORD` in `packages/db/.env`. The shared password must be 12–128 characters. The
runner hashes it before storing credentials, marks seeded users approved and
enabled, and does not require a password change.

The runner only accepts loopback database hosts and rejects production-like
database names. Never add real credentials or personnel data to these fixtures.

## Inventory demo

The TypeScript fixtures add two demo storage rooms, their shared custodians, six assets, and three consumable types. Opening receipts and two employee issues appear in transaction history. Reruns preserve current balances, custody, asset condition and location, storage configuration, and workflow progress. Add new opening data in new transaction batches.

| Username                    | Demo access                                                      |
| --------------------------- | ---------------------------------------------------------------- |
| `staff_one` and `staff_two` | My Items shows their own current equipment assignments           |
| `inventory_operator`        | Inventory reads, configuration, movements, and physical disposal |
| `inventory_requester`       | Start removal proposals and revise returned requests             |
| `inventory_reviewer`        | Review requests and open the workflow monitor                    |
| `inventory_recorder`        | Record committee decisions or return requests                    |

Use the configured `SEED_USER_PASSWORD` for each account. These roles are provisioned only by the local seed.

1. Open Inventory standalone or in the shell. Sign in as `inventory_requester` and use **Propose asset removal** to start a proposal with `DEMO-INV-003`, `DEMO-INV-004`, and `DEMO-INV-005`. Include a reason for each.
2. In the reviewer inbox, return the proposal with a comment. Sign back in as requester and resubmit the revision. Then forward it from the reviewer inbox.
3. Open the recorder inbox and record a named, dated decision with a reference. Approve `DEMO-INV-003` for waste, reject `DEMO-INV-004`, and defer `DEMO-INV-005`, giving a reason for each.
4. As `inventory_operator`, open **Transactions**, choose **Disposal**, and post a separate disposal transaction for the approved asset. The decision and disposal appear as separate ledger entries.

See the [Inventory app guide](../../../../apps/inventory/README.md) for both frontend entry points.

## Seed tests

Run `pnpm --filter @project/db test:seed` for fixture validation tests.
Set `SEED_TEST_DATABASE_URL` to a loopback PostgreSQL connection string to also
run integration tests. That database user must have permission to create databases.
The tests create a randomly named temporary database, apply migrations, and drop
it afterward; they do not seed or truncate the database named in the supplied URL.
Integration coverage includes initial creation, role descriptions and grants,
repeated seeding, administrator password preservation, account collision rejection,
and rollback after a later database failure. Without the URL, the integration
suite is skipped.
