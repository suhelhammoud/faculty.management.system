# Facilities administration API

Facilities uses the shared authenticated API and cookie session. The frontend is served at port 3010 by default. Add its exact origin, and the shell origin when applicable, to `TRUSTED_ORIGINS`.

The shared authorization catalog defines `facilities:read` and `facilities:write`; synchronize it after migrations with `pnpm --filter @project/db seed:permissions`. Migration `0002_facilities-permissions.sql` remains in migration history and provides the initial **Facilities Administrator** role and grants. New bootstrap administrators receive the configured defaults. Other accounts must be assigned Facilities Administrator through shared Administration. See the [shared authorization guide](../authorization/README.md) for the permission, role, and seed workflow.

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
