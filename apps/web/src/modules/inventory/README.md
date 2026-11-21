# Inventory

Open Inventory in the [faculty web app](http://localhost:3000/inventory). The
English/Arabic setting is saved in the browser.

## Local setup

1. Start PostgreSQL and apply the committed migrations. To populate demo records, run
   `pnpm --filter @project/db seed:local`.
2. Run `pnpm dev:api` and `pnpm dev` in separate terminals. Include
   `http://localhost:3000` in the API's `TRUSTED_ORIGINS`.
3. Configure `VITE_API_URL` in [the web app](../../../README.md) if the API is on a
   different origin.

## Demo walkthrough

All demo users use the local `SEED_USER_PASSWORD`.

- Sign in as `staff_one` or `staff_two` and open **My Items**. Each account sees its
  own current durable assets without permission to browse the register.
  Use **Report a discrepancy** beside an assigned asset to flag its assignment,
  room, or condition.
- Sign in as `inventory_operator` to browse assets, stock and transactions. Use
  **New transaction** to receive stock. Open an issue, handover or return from
  an eligible **Assets** row, or start a consumable issue from **Stock**.
  The form preselects the item and shows the expected custody or stock balance.
  Open **Discrepancy reports** to review employee reports and record review notes.
  Post any needed corrections through the usual Inventory transactions.
  Use **Settings** to configure storage rooms, shared custody and the consumable catalog.
- In **Task inbox**, `inventory_requester` can propose tagged assets
  `DEMO-INV-003` through `DEMO-INV-005`. The `inventory_reviewer` can return the
  proposal, then forward the revised submission. The `inventory_recorder` can record
  approved, rejected and deferred outcomes. The operator can then record physical
  disposal as a separate transaction.

The web app keeps its shared inbox at `/workflow/tasks`. Inventory tasks open the
localized views under `/inventory/workflow/`. Direct links to the shared
task and history URLs still resolve. See the [Inventory API](../../../../../docs/modules/inventory/API.md)
for permissions and transaction payloads.

Run `pnpm --filter web test src/modules/inventory` for the Inventory UI tests.
