# Facilities

See [Data model](./DATA-MODEL.md) for the implemented Drizzle entities, relationships, and constraints.

## Purpose

Maintains the faculty's physical location registry and provides room context for equipment tracked by Inventory.

## Initial entities

- **Building** — a faculty building.
- **Floor** — belongs to a building.
- **Room** — belongs to a floor and has a room code, title, room type, classroom capacity values, and status.
- **Room type** — categories such as classroom, laboratory, office, or storage.

Rooms are a flat list within each floor; nested rooms are out of scope for the initial model. Room codes should be unique within a building, since the same code may occur in different buildings. Each room has a human-readable title for listings and printed reports, separate from its room code (for example, code `B-204`, title “Networking Laboratory”).

Classrooms record **maximum student capacity** and **current available student capacity**. The maximum is the room's established limit. Current available capacity records how many student places are currently usable; it may be lower when desks or seats are unavailable. Store only the current available value, without a history of changes. Both capacity values are optional for room types where student capacity does not apply. Class-specific unallocated seats are a scheduling value and should not be stored as the room's current available capacity.

## Equipment boundary

Inventory owns equipment records, responsibility, and custody history. Facilities does not create duplicate equipment records. A room's equipment list is derived from Inventory items whose current location is that room. Equipment may have no room location, such as a handheld projector assigned to an employee.

## Open decisions

- What room types and status values should be available?
- Should room location changes have their own history, or rely on Inventory's location history?
