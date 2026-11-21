# Facilities frontend

Open Facilities in the [faculty web app](http://localhost:3000/facilities/rooms).

## Run locally

1. Apply database migrations with `pnpm --filter @project/db migrate` and start the API with `PORT=4000`.
2. Include `http://localhost:3000` in the API’s trusted origins. Assign the **Facilities Administrator** role to the intended account through Administration.
3. Configure `VITE_API_URL` in [the web app](../../../README.md) if you use a different API origin.
4. Run the API and web app in separate terminals:

   ```sh
   pnpm dev:api
   pnpm dev
   ```

The app uses the shared session cookie and Facilities API. The API remains authoritative for permissions. The frontend supports English/LTR and Arabic/RTL; only the language choice is saved in browser storage.

## Screens

- `/facilities/rooms` lists rooms, filters by building, floor, type, and status, and creates or edits rooms.
- `/facilities/settings` maintains buildings, floors, and room types.

The interface does not manage equipment, room reservations, or room-capacity history. See [Facilities API](../../../../../docs/modules/facilities/API.md) and the [Facilities data model](../../../../../docs/modules/facilities/DATA-MODEL.md).
