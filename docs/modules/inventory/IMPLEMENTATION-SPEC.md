# Inventory Application Implementation Specification

## Project context

This repository is a monorepo with a React/TypeScript frontend, a NestJS API, PostgreSQL, and Drizzle ORM. The `apps/inventory` frontend is currently a starter scaffold. `apps/api/src/modules/inventory/inventory.module.ts` is empty. Database schema and migrations live in `packages/db`.

Follow the architecture, authentication, validation, styling, and error-handling patterns used by existing modules. Inventory should work as a standalone frontend and through the shared app shell.

## Purpose

Track durable equipment and consumable stock, their locations, responsible parties, receipts, issues, transfers, and removal decisions.

Inventory owns equipment details and custody history. Room locations should reference rooms maintained by Facilities. Do not duplicate employee records owned by HR.

## Tracking modes

### Individually tracked assets

Use individual records for durable equipment such as laptops, projectors, and lab machines.

Each asset must have a unique inventory identifier/tag. Store relevant details such as name, category, model, serial number, acquisition/receipt reference, status, notes, and timestamps. Keep the initial field set practical; avoid speculative complex asset accounting.

Track separately:

- **Responsible party/custodian:** an HR employee or a clearly distinguished shared responsibility account.
- **Physical location:** an optional Facilities room.
- **Status:** a small, maintainable set such as available, assigned, under repair, lost, or decommissioned.

Responsibility and room location are independent. An asset may have a responsible employee without a room location, or a room location without an individual custodian.

### Consumable stock

Use quantity-based stock records for items such as paper, clips, and pens. These items do not receive individual asset tags and are not added to an employee’s ongoing list of assets.

Track stock by item and storage location, using an appropriate unit such as each, box, or ream. An issue to an employee records the recipient and quantity and reduces the storage balance. It must not create an ongoing employee custody assignment.

## Transactions

Record all inventory movements and decisions as named, dated transactions. A transaction may include multiple items.

A transaction should record:

- A human-readable name or reference.
- Transaction type.
- Date the event occurred.
- Date/time it was entered, if different.
- User who recorded it.
- Source and destination endpoints where applicable. Endpoints can include a user, storage location, purchase receipt/external source, Head Administration, or waste/disposal.
- Item lines, including quantity for consumables and asset references for individually tracked items.
- Notes and relevant supporting reference numbers.

Retain transaction history. Do not erase history when an item is transferred, decommissioned, or disposed.

### Initial transaction workflows

1. **Receipt into storage**
   - Support receipts based on a purchase receipt or a transfer from Head Administration.
   - Record the source, receiving storage location, date, reference, and item lines.
   - For durable goods, create an individual asset record for each item received.
   - For consumables, increase the stock quantity at the receiving location.

2. **Asset issue/assignment**
   - Move an asset from storage to a user.
   - Record the user as the recipient/current responsible party.
   - Do not change the room location unless a physical room is explicitly provided.

3. **Asset handover**
   - Transfer responsibility from one user to another.
   - Keep room location independent unless the transaction explicitly records a room move.

4. **Asset return**
   - Return an asset from a user to a storage location.
   - Clear the current individual custodian and record the destination location.

5. **Storage relocation**
   - Move assets or consumable quantities between storage locations.
   - Update the appropriate current asset location or stock balances.

6. **Consumable issue**
   - Record recipient, quantity, unit, source storage location, and date.
   - Reduce the source stock balance.
   - Do not add the consumables to the employee’s assigned assets or ongoing custody list.

7. **Consumable adjustment**
   - Support a recorded increase or decrease in stock, with date and reason, for cases such as loss, damage, count correction, or waste.
   - Preserve the adjustment in transaction history.

8. **Committee removal decision**
   - Allow malfunctioning assets to be proposed for review by the removal committee.
   - Record the proposed items and the committee decision per item in a named, dated transaction, including decision reference and reason.
   - Support at least approved for waste, not approved, and deferred outcomes. Keep the outcome structure easy to extend if the institution defines additional decisions.
   - Only an approved-for-waste decision changes the asset to a decommissioned/waste status and ends its active custody. Rejected or deferred items retain their current status and custody.
   - Keep the asset and all its history for audit purposes. If physical disposal occurs later, record it as a separate dated transaction.

## Storage locations and integrations

- Use Facilities as the source of truth for rooms. Inventory should reference room IDs rather than creating duplicate room records.
- Support identifying which Facilities rooms are valid storage locations. Follow existing Facilities room type/data conventions where possible.
- Reference HR employee records for individual responsible parties.
- Shared responsibility accounts must be distinguishable from real employee records and must not be stored as fake HR employees.
- Keep any future Maintenance integration out of scope unless an existing API contract already makes it straightforward.

## API and permissions

- Add the Inventory module to the NestJS API using the project’s existing module, controller, service, validation, and database patterns.
- Use validated request schemas and transactional database writes for multi-item receipts and movements so partial failures do not leave balances or custody inconsistent.
- Add inventory-specific read/write permissions through the shared authorization system. Committee decisions must require an appropriate write permission. Do not bypass shared sign-in or authorization.
- Provide endpoints for listing/searching assets and stock, reading transaction history, and creating the supported transactions.
- Put workflow API routes under `/api/workflow/`, for example `GET /api/workflow/tasks`, `GET /api/workflow/instances/:instanceId`, and `POST /api/workflow/tasks/:taskId/actions`.
- Keep API payloads and responses typed and consistent with project conventions.

## Frontend

Build the Inventory app using existing frontend conventions and shared components.

All frontend workflow routes must include the `/workflow/` path segment. Use routes such as `/workflow/tasks`, `/workflow/tasks/:taskId`, and module-specific routes such as `/inventory/workflow/removal-requests/:requestId`. Pass stable IDs in the URL and fetch workflow and business data from the API so deep links and refreshes work.

Provide screens or views for:

- Asset register with search and filters by tag, name/category, status, responsible party, and room.
- Consumable stock by item and storage location, showing on-hand quantity and unit.
- Transaction history with filters by type, date, user, item, and reference.
- Forms for receiving items, assigning/transferring/returning assets, moving stock, issuing consumables, and recording stock adjustments.
- Committee removal proposals and decisions, showing each item’s outcome and reason.

Show the current asset custodian and physical location as separate fields. Show consumable issues in transaction history without displaying them as employee-held assets.

## Data integrity and audit requirements

- Use database constraints for unique asset tags and valid foreign-key relationships.
- Prevent stock issues that exceed available stock unless the institution explicitly allows negative stock.
- Apply multi-item transactions atomically.
- Record who entered each transaction and when.
- Preserve completed transactions and asset history; use corrective transactions rather than silently rewriting history.
- Ensure balances and current asset state remain consistent with transaction processing.

## Acceptance criteria

- A user can record a multi-item receipt from a purchase reference or Head Administration into storage.
- Durable items receive individual asset records; consumables increase quantity-based stock.
- An asset can be assigned to a user, handed to another user, returned to storage, or moved between rooms while preserving transaction history.
- Responsibility and room location can be maintained independently.
- A consumable issue to an employee reduces storage stock and appears in transaction history, but does not appear in that employee’s assigned assets.
- A committee can record a dated, named decision per proposed asset. Approved items become decommissioned/waste and are no longer actively assigned; rejected or deferred items remain in their existing state.
- Existing shared authentication and permission checks protect Inventory API operations.
- Inventory navigation and standalone development continue to follow the repository’s app conventions.

## Decisions to confirm before implementation

If the repository does not already settle these points, identify them before making assumptions:

- The exact inventory status and committee decision values.
- The required asset fields and consumable units.
- Which Facilities rooms count as storage locations.
- Whether shared responsibility accounts are created inside Inventory or maintained by an administrator elsewhere.
- Which user roles receive read, write, and committee-decision permissions.
