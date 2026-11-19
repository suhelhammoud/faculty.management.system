# Inventory

Inventory runs standalone at [localhost:3008/inventory](http://localhost:3008/inventory)
and inside the [faculty shell](http://localhost:3000/inventory). Both use the same routes.
The English/Arabic setting is saved separately for each browser origin.

## Local setup

1. Start PostgreSQL and apply the committed migrations. To populate demo records, run
   `pnpm --filter @project/db seed:local`.
2. Run `pnpm dev:api`, then `pnpm dev:inventory`. Run `pnpm dev:shell` as well to use
   the embedded app.
3. Configure `VITE_API_URL` in Inventory and the shell if the API is not on port 4000.
   The shell takes `VITE_INVENTORY_REMOTE_URL` at build time, defaulting to
   `http://localhost:3008/remoteEntry.js`. Include both frontend origins in the API’s
   `TRUSTED_ORIGINS`. Use a deployment where the API session cookie is available to
   both clients.

## Demo walkthrough

All demo users use the local `SEED_USER_PASSWORD`.

- Sign in as `staff_one` or `staff_two` and open **My Items**. Each account sees its
  own current durable assets without permission to browse the register.
- Sign in as `inventory_operator` to browse assets, stock and transactions. Use
  **New transaction** to receive stock, issue equipment and return it to storage.
  Use **Settings** to configure storage rooms, shared custody and the consumable catalog.
- In **Task inbox**, `inventory_requester` can propose tagged assets
  `DEMO-INV-003` through `DEMO-INV-005`. The `inventory_reviewer` can return the
  proposal, then forward the revised submission. The `inventory_recorder` can record
  approved, rejected and deferred outcomes. The operator can then record physical
  disposal as a separate transaction.

The shell keeps its shared inbox at `/workflow/tasks`. Inventory tasks open the
localized views under `/inventory/workflow/`. Direct links to the existing shell
task and history URLs still resolve. See the [Inventory API](../../docs/modules/inventory/API.md)
for permissions and transaction payloads.

Run `pnpm --filter inventory test` for the UI tests. Deploy the additive API changes
before the Inventory remote, then update the shell.
