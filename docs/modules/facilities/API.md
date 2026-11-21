# Facilities administration API

Facilities uses the shared authenticated API and cookie session. The frontend is served at port 3010 by default. Add its exact origin, and the shell origin when applicable, to `TRUSTED_ORIGINS`.

Run `pnpm --filter @project/db seed:permissions` after migrations to synchronize `facilities:read` and `facilities:write` from the shared catalog. The **Facilities Administrator** role bundles both permissions by default. A global elevated grant can provide `facilities:write` for a limited number of attempts. Listing Facilities records requires `facilities:read`. [Shared authorization guide](../authorization/README.md#elevated-grants)

## Endpoints

All endpoints are under `/api/admin/facilities`.

| Method | Path              | Permission         | Purpose                                         |
| ------ | ----------------- | ------------------ | ----------------------------------------------- |
| GET    | `/`               | `facilities:read`  | Return buildings, floors, room types, and rooms |
| POST   | `/buildings`      | `facilities:write` | Create a building                               |
| PATCH  | `/buildings/:id`  | `facilities:write` | Edit a building                                 |
| POST   | `/floors`         | `facilities:write` | Create a floor                                  |
| PATCH  | `/floors/:id`     | `facilities:write` | Edit a floor                                    |
| POST   | `/room-types`     | `facilities:write` | Create a room type                              |
| PATCH  | `/room-types/:id` | `facilities:write` | Edit a room type                                |
| POST   | `/rooms`          | `facilities:write` | Create a room                                   |
| PATCH  | `/rooms/:id`      | `facilities:write` | Edit a room                                     |

Rooms require an existing building, floor within that building, and room type. Building room codes and floor numbers are unique within their parent building. Capacities are optional, must be nonnegative integers, and available capacity cannot exceed maximum capacity. Deletion and equipment management are not exposed.
