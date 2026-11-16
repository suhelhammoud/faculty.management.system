# Asset Inventory System

## Purpose

Tracks equipment inventory, responsible parties, room locations, and asset transfers.

## Users and workflows

Each item has one mandatory **responsible party**. This may be a real employee or a shared responsibility account (for example, “Shared Lab Equipment” or “Faculty Equipment Pool”). Responsibility accounts must be distinguishable from real employee records.

Responsibility and physical location are independent. An item can be assigned to an employee with no room location (such as a handheld projector), located in a room with no individual employee responsible, or have both. Room locations reference rooms maintained by [Facilities](../facilities/README.md). Inventory remains the source of truth for equipment details, responsible party, and custody history; Facilities can display items by their current room location.

User groups, assignment steps, transfers, and any transfer approval are open.

## Permissions and dependencies

No module-specific permissions or dependencies are defined. Shared sign-in and access are described in [identity and access](../../identity-and-access.md). Relationship to HR employee records and Maintenance requests is undecided.

## Open decisions

- What equipment identifiers, attributes, and inventory states are needed?
- Who records assignments and transfers, and is any approval required?
- How should shared responsibility accounts be created and maintained?
- How should Inventory reference employee records from HR?
- How should maintenance requests link to Inventory items?
