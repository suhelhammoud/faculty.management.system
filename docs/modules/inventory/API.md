# Inventory API

Inventory owns asset custody, stock balances, and posted transaction history. Facilities owns rooms and HR owns employees. IDs in Inventory requests refer to those source records.

## Access and configuration

Write requests use the existing authenticated session and trusted browser origin. Grant Inventory permissions through Administration after running `pnpm --filter @project/db migrate` and `pnpm --filter @project/db seed:permissions`.

| Permission                                                                          | Access                                                                      |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `inventory:read`                                                                    | Asset and stock lists, transaction history, and reference lists             |
| `inventory:configure`                                                               | Create shared accounts and consumable catalog items, and configure storage  |
| `inventory:post-transactions`                                                       | Post receipts, movements, condition changes, and stock adjustments          |
| `inventory:dispose`                                                                 | Post physical disposal for approved assets                                  |
| `inventory:manage-assets`                                                           | Legacy asset registration and employee custody endpoints                    |
| `inventory:request-removal`, `inventory:removal-review`, `inventory:removal-decide` | Submit proposals, review them, and record committee decisions, respectively |

All paths below are relative to `/api/inventory`.

| Method and path                                                            | Input or filters                                                                                                                 |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `GET /assets`                                                              | `q`, `category`, `status`, `condition`, `roomId`, `employeeId`, `sharedAccountId`. Returns asset and current custody separately. |
| `GET /stock`                                                               | `q`, `roomId`, `consumableId`. Returns the room, whole quantity, and catalog item including its unit.                            |
| `GET /transactions`                                                        | `type`, `from`, `to`, `actorId`, `assetId`, `consumableId`, `reference`                                                          |
| `GET /transactions/:id`                                                    | Returns the recorded header and typed item lines. Asset lines can include before and after snapshots.                            |
| `GET /rooms`, `/storage`, `/shared-accounts`, `/employees`, `/consumables` | `q`                                                                                                                              |
| `POST /shared-accounts`                                                    | `{ name }`                                                                                                                       |
| `POST /consumables`                                                        | `{ code, name, unit }`. Choose a fixed unit such as each, box, or ream.                                                          |
| `PUT /storage/:roomId`                                                     | `{ sharedAccountId, enabled? }`. Enabling requires an active Facilities room. Disabled storage can still be emptied.             |

List endpoints accept `offset` and `limit`, which defaults to 50 and accepts at most 100. Changing a storage designation does not change existing asset custody. Assets with no known historical condition use `unassessed`.

## Post a transaction

Send `POST /transactions` with `type`, `name`, `eventDate` (YYYY-MM-DD), `items`, optional `reference`, and optional `notes`. The response is `201` with `{ id, type }`. An `Idempotency-Key` header lets the same actor retry an identical request and receive the same result. Stale asset revisions, insufficient stock, and reuse of a key with different input return `409`. A request either posts in full or rolls back.

A party is `{ kind: "employee" | "shared", id }`. Existing assets use `{ assetId, expectedRevision }`. Each asset and each consumable can appear at most once per request.

| Type                    | Additional header and item fields                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `receipt`               | Provide `reference`, `source` (`purchase` or `head-administration`), and `destinationRoomId`. Asset lines use `{ kind: "asset", tag, name }` with optional condition, category, model, serialNumber, acquisitionReference, and notes. Stock lines use `{ kind: "consumable", consumableId, quantity }`. |
| `asset-issue`           | Provide `sourceRoomId` and `recipient`. Assets must be at the source in shared custody.                                                                                                                                                                                                                 |
| `asset-handover`        | Provide `from` and `recipient`. The current custodian must match `from`.                                                                                                                                                                                                                                |
| `asset-return`          | Provide `from` and `destinationRoomId`. Sets room and custody to the destination storage room and its shared custodian.                                                                                                                                                                                 |
| `storage-relocation`    | Provide `sourceRoomId` and `destinationRoomId`. Asset lines add `kind: "asset"`; stock lines use `{ kind: "consumable", consumableId, quantity }`. Asset custody stays the same.                                                                                                                        |
| `consumable-issue`      | Provide `sourceRoomId` and `employeeId`. Lines use `{ consumableId, quantity }`. No custody is created.                                                                                                                                                                                                 |
| `consumable-adjustment` | Provide `roomId`. Lines use `{ consumableId, delta, reason }` with a signed, nonzero whole delta.                                                                                                                                                                                                       |
| `condition-change`      | Each asset line adds `condition` and `reason`. Conditions are `serviceable`, `malfunctioning`, `under-repair`, `lost`, and `unassessed`.                                                                                                                                                                |
| `disposal`              | Provide `reference` and previously approved, decommissioned asset lines. Sets lifecycle to `disposed` and clears the current room.                                                                                                                                                                      |

For asset issue and handover, omit `destinationRoomId` to preserve the room, supply a room ID to move the asset, or send null explicitly to clear it.

## Committee removal

Start with `POST /workflow/removal-requests` relative to `/api/inventory`. Supply active asset IDs and a reason for each. Use the existing proposal detail and asset picker endpoints under `/api/inventory/workflow`.

Use `GET /api/workflow/tasks` for the signed-in user's inbox. Open the task at `/workflow/tasks/:id` in the shell and submit actions to `POST /api/workflow/tasks/:id/actions`.

1. Review can **forward** to an authorized decision recorder, **return** with a reason to the original requester, or **reject** the proposal and close the workflow.
2. The requester can **resubmit** a new revision. This opens a new review task and keeps the old revisions.
3. The decision recorder can **return** with a reason or **record-decision** with a name, reference, date, and an outcome and reason for each asset. A user with both permissions can review and record a decision.

A recorded decision posts a single committee transaction. Only approved-for-waste items are decommissioned and leave custody. Rejected and deferred assets keep their state. If an approved asset changed since the proposal revision, the decision returns `409` and leaves the committee task pending so it can be returned. Physical disposal is a separate transaction.
