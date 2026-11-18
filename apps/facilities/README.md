# Facilities frontend

React/Vite Facilities app at `http://localhost:3010/facilities/rooms`, also exposed as `facilities/App` through Module Federation. The shell mounts it at `/facilities/*`.

## Run locally

1. Apply database migrations with `pnpm --filter @project/db migrate` and start the API with `PORT=4000`.
2. Configure the API trusted origins to include `http://localhost:3010` and `http://localhost:3000` when using the shell. Assign the **Facilities Administrator** role to the intended account through Administration.
3. Copy `.env.example` to `.env` only if you need to change the public `VITE_API_URL` build-time setting. Never put credentials in Vite variables.
4. Run the API, Facilities, and optionally the shell:

   ```sh
   pnpm dev:api
   pnpm dev:facilities
   pnpm dev:shell
   ```

The app uses the shared session cookie and Facilities API. The API remains authoritative for permissions. The frontend supports English/LTR and Arabic/RTL; only the language choice is saved in browser storage.

## Screens

- `/facilities/rooms` lists rooms, filters by building, floor, type, and status, and creates or edits rooms.
- `/facilities/settings` maintains buildings, floors, and room types.

The interface does not manage equipment, room reservations, or room-capacity history. See [Facilities API](../../docs/modules/facilities/API.md) and the [Facilities data model](../../docs/modules/facilities/DATA-MODEL.md).
