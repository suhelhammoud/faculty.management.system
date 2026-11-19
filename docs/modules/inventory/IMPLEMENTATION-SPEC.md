# Inventory Application Implementation Specification

## Project context

Inventory runs as a standalone app at `http://localhost:3008/inventory` and as a
module in the faculty shell at `/inventory`. Both use the same React and TypeScript
screens backed by the shared NestJS API. React Router handles navigation, TanStack
Query handles server data, Zustand stores language preference, and i18next provides
Arabic and English text. The UI uses shadcn components with scoped Tailwind styles.

The API uses PostgreSQL and Drizzle. See the [API reference](API.md) for endpoint
contracts and the [local app guide](../../../apps/inventory/README.md) for setup.

## Purpose

Track durable equipment and consumable stock, their locations, responsible parties, receipts, issues, transfers, and removal decisions.

Inventory owns equipment details and custody history. Room locations reference Facilities records and individual custodians reference HR employees.

## Tracking modes

### Individually tracked assets

Use individual records for durable equipment such as laptops, projectors, and lab machines.

Each asset must have a unique inventory identifier/tag. Store relevant details such as name, category, model, serial number, acquisition/receipt reference, status, notes, and timestamps. Keep the initial field set practical; avoid speculative complex asset accounting.

Track separately:

- **Responsible party/custodian:** an HR employee or a clearly distinguished shared responsibility account.
- **Physical location:** an optional Facilities room.
- **Lifecycle and condition:** lifecycle is active, decommissioned, or disposed. Condition is separate and records whether the asset is serviceable, malfunctioning, under repair, lost, or unassessed.

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

Authorized operators post inventory movements directly. Committee removal is the only operation that uses the approval inbox.

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
   - Allow any active asset to be proposed for committee removal, with a reason for each asset.
   - Record the proposed items and the committee decision per item in a named, dated transaction, including decision reference and reason.
   - Record one of three outcomes per item: approved for waste, rejected, or deferred.
   - Only an approved-for-waste decision changes the asset to a decommissioned/waste status and ends its active custody. Rejected or deferred items retain their current status and custody.
   - Commit asset changes, the committee ledger entry, and workflow completion together. A stale approval returns `409` and leaves the task open so the recorder can return the proposal for revision.
9. **Asset condition change**
   - Record the new condition and a reason. The current room and custodian stay the same.
10. **Physical disposal**
    - An authorized operator records disposal as a separate dated transaction after committee approval. Disposal clears the asset's current room, changes its lifecycle to disposed, and preserves its history.

## Storage locations and integrations

- Use Facilities as the source of truth for rooms. Inventory should reference room IDs rather than creating duplicate room records.
- Inventory explicitly designates individual Facilities rooms as storage and configures a shared custodian for each.
- Reference HR employee records for individual responsible parties.
- Shared responsibility accounts must be distinguishable from real employee records and must not be stored as fake HR employees.
- Keep any future Maintenance integration out of scope unless an existing API contract already makes it straightforward.

## API and permissions

- Use validated request schemas and transactional database writes for multi-item receipts and movements so partial failures do not leave balances or custody inconsistent.
- Grant Inventory permissions through shared Administration. General reads and reference pickers require `inventory:read`. Settings and movement forms require their corresponding write grants as well. Workflow task access depends on the request and the active step.
- `GET /api/inventory/capabilities` reports the signed-in user's capabilities and whether they have a linked HR profile. The UI uses those flags for navigation. Each API endpoint still enforces its own access rules.
- Provide endpoints for listing/searching assets and stock, reading transaction history, and creating the supported transactions.
- Start removal requests with `POST /api/inventory/workflow/removal-requests` and load proposal details with `GET /api/inventory/workflow/removal-requests/:requestId`.
- Use `GET /api/inventory/workflow/assets` to choose assets for a proposal. Asset managers can register an asset with `POST /api/inventory/workflow/assets` and update its HR employee custody with `PATCH /api/inventory/workflow/assets/:id/custody`.
- Use the shared task and history endpoints under `/api/workflow/`. Submit every workflow action, including the committee decision, through `POST /api/workflow/tasks/:taskId/actions`. Inventory validates the per-item decisions and commits custody changes, Inventory transaction records, and workflow progression together. Follow the [shared workflow API and transaction contract](../workflows/IMPLEMENTATION-PLAN.md#api-and-transaction-behavior).
- Keep API payloads and responses typed and consistent with project conventions.

## Frontend

English is the default. The language switch is available on the sign-in screen and
persists separately for the standalone and shell browser origins. Arabic uses
right to left layout within Inventory, including dialogs. Asset tags and
references retain their own text direction. The shell's top level navigation
keeps its existing language.

| Route                               | What users can do                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `/inventory/my-items`               | View their current durable asset assignments.                                                                                         |
| `/inventory/assets`                 | Search by tag, name, or category and filter by lifecycle, condition, room, or responsible party. View details and open asset history. |
| `/inventory/stock`                  | Search consumables and filter balances by item and storage room. View each item's unit.                                               |
| `/inventory/transactions`           | Filter posted history by type, date range, recording user, asset or consumable, and reference.                                        |
| `/inventory/transactions/:id`       | Read movement details, including recorded dates, participants, quantities, and committee outcomes where applicable.                   |
| `/inventory/transactions/new/:type` | Fill in fields and repeatable item lines for a receipt, movement, adjustment, condition change, or disposal.                          |
| `/inventory/settings`               | Designate Facilities rooms as storage, assign shared custodians, and create shared accounts and consumables.                          |

Lists use URL filters and pagination. For an asset issue or handover, users can
keep, change, or clear the room independently of custody. Transaction forms
retry unchanged submissions with the same idempotency key. If an asset revision
is stale, the form keeps the draft and lets the user review refreshed asset
details before trying again.

### My Items

Any active signed-in user can open My Items without `inventory:read`. The API
identifies the employee through the account's HR link and takes no employee ID
from the caller. It returns active durable assets with current individual
custody, including the asset tag, name, condition, optional room, and assignment
date. Shared custody, past assignments, consumable issues, and retired assets
are excluded. The screen distinguishes an unlinked account from an employee
with no active assignments.

The Inventory landing route opens Assets for users with register access, My Items
for linked employees without that access, and the Inventory task inbox for other
active users. My Items refreshes on entry and when the window regains focus.

### Removal pages and task routing

| Route                                             | Page                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| `/inventory/workflow/tasks`                       | Inventory task inbox                                                  |
| `/inventory/workflow/tasks/:taskId`               | Review, Revise, or Committee Decision based on the current task       |
| `/inventory/workflow/instances/:instanceId`       | Instance status and history                                           |
| `/inventory/workflow/monitor`                     | Inventory monitor for users with `workflow:monitor` and record access |
| `/inventory/workflow/removal-requests/new`        | Start a removal proposal                                              |
| `/inventory/workflow/removal-requests/:requestId` | Proposal revisions and the recorded committee decision                |

The shell keeps its shared inbox and monitor. When a shell task or history link
identifies an Inventory removal record, it opens the localized Inventory page
for the same ID. The page shows the actions allowed by the shared workflow API.
After a successful action, it opens instance history. The next task appears in the
inbox of eligible users. A return sends the proposal to its original requester,
and resubmission opens a fresh review task. See the
[workflow diagrams](../workflows/inventory-removal.md).

## Data integrity and audit requirements

- Use database constraints for unique asset tags and valid foreign-key relationships.
- Prevent stock issues that exceed the available balance.
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
- Linked employees without `inventory:read` can see only their current assignments. A return or handover changes what the affected employees see in My Items.
- English and Arabic are usable both standalone and in the shell. Existing Inventory task and history links still resolve to the same records.

## Operational decisions

- Each consumable has one fixed unit and uses whole quantities.
- An active asset can be proposed for removal with a reason, regardless of its recorded condition.
- Only removal uses the approval inbox. The reviewer and the committee decision recorder may be the same person if that person has both grants.
- Grant Inventory capabilities through shared Administration. Configure storage rooms and their shared custodians before receiving inventory.
