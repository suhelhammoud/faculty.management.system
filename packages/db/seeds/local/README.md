# Local seed fixtures

These committed fixtures contain synthetic demo users and HR records. They are
loaded by `pnpm --filter @project/db seed:local` after the database migrations have been
applied.

User roles are declared in `auth.users.json`: `hr_admin` grants the HR Administrator
role and `facilities_admin` grants the Facilities Administrator role. The
`facility_1` demo account has Facilities permissions for managing facilities, and
does not receive HR permissions. Re-running the seed reconciles these two seeded
roles for fixture users.

HR staff categories and initial academic ranks follow the examples in the HR
documentation. Positions and the grade scheme are labeled as demo data because
the documentation does not define institution-specific position or pay-scale
records.

Seed logic is split across `src/seed/auth.ts`, `src/seed/hr.ts`, and
`src/seed/facilities.ts`; the driver in `src/seed/local.ts` runs them in order
inside one transaction. Add future module seeders to that driver after their
prerequisite seeders.

`facilities.json` seeds one placeholder building, two floors, and the supplied
12 labs, 6 classrooms, and 6 theaters. Labs are assigned six per floor as
specified. Since floor locations were not provided for classrooms and theaters,
their numbers 7–9 and 1–3 are assigned to floor 1; 10–12 and 4–6 are assigned
to floor 2. Replace the placeholder building code/title with the institution's
actual building details when available. Room capacities remain unset because
none were provided.

Set `DATABASE_URL` and `SEED_USER_PASSWORD` in the ignored
`packages/db/.env` file. The shared password must be 12–128 characters. The
runner hashes it before storing credentials, marks seeded users approved and
enabled, and does not require a password change.

The runner only accepts loopback database hosts and rejects production-like
database names. Never add real credentials or personnel data to these fixtures.
