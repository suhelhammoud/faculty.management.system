# Local seed fixtures

These committed fixtures contain synthetic demo users and HR records. They are
loaded by `pnpm --filter @project/db seed:local` after the database migrations have been
applied.

HR staff categories and initial academic ranks follow the examples in the HR
documentation. Positions and the grade scheme are labeled as demo data because
the documentation does not define institution-specific position or pay-scale
records.

Seed logic is split into `src/seed/auth.ts` and `src/seed/hr.ts`; the driver in
`src/seed/local.ts` runs them in order inside one transaction. Add future module
seeders to that driver after their prerequisite seeders.

Set `DATABASE_URL` and `SEED_USER_PASSWORD` in the ignored
`packages/db/.env` file. The shared password must be 12–128 characters. The
runner hashes it before storing credentials, marks seeded users approved and
enabled, and does not require a password change.

The runner only accepts loopback database hosts and rejects production-like
database names. Never add real credentials or personnel data to these fixtures.
