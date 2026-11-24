# Department

Open **Department** from the module directory or go to `/department`. The workspace manages the shared department directory, curriculum plans, and bulk student assignments. Department controls are currently in English.

## Setup and access

Start the local PostgreSQL container if needed, then apply the migrations to the database configured in `packages/db/.env.db`:

```sh
pnpm --filter @project/db db:start
podman exec faculty-postgres pg_isready -U faculty -d faculty_db
pnpm --filter @project/db migrate
```

Wait for PostgreSQL to accept connections before running the migration. On a fresh setup, synchronize the permission catalog as part of the [standard setup](../../../README.md#configure-migrate-and-seed).

- Grant `student-affairs:read` for the department directory and curriculum views.
- Grant both `student-affairs:read` and `student-affairs:administer` to staff who manage departments, publish plans, and assign them. Use shared Administration to grant these permissions explicitly.

## Load the supplied curricula

After migrating, run `pnpm --filter @project/db seed:curricula` to load the Legacy Curriculum and the 2025–2026 Curriculum for Software Engineering, Networks and Computer Systems, and Artificial Intelligence. This command uses the configured database and can be run again to verify the seeded versions. Staff can then assign a version in Department.

Both names appear on each seeded module. A dash in the credits or marks column means the source does not specify that value. The graduation project marks describe the whole project across both semesters. [Source and transcription notes](../../../packages/db/src/seed/fixtures/curricula/README.md)

## Manage departments and plans

1. Create a department with a unique code and a display name. Use lowercase letters, numbers, and hyphens in the code. The code is permanent and the name can be updated.
2. In **Student Affairs**, open a student's profile and choose their department when creating or editing the record. Existing write permissions and study year assignments apply. A student without a department becomes eligible for plan assignment once staff sets an active department.
3. In **Department**, select the department and create a curriculum draft. In the draft, edit the **Plan title**, description, adoption date, ministry decision, and remarks. Add modules to any of the ten semesters. Each module has a code, name, weekly theory hours, weekly lab hours, credits, and a required or elective designation.
4. Save the draft, then publish it. Publication requires at least one module. If any semesters are empty, confirm them explicitly before publishing.
5. To revise a published plan, open its next draft. The draft starts with the latest version’s modules, description, and remarks. Enter the adoption date and ministry decision for the new version when available. Publication creates a new assignable version in the same plan history, even if the plan's name changed.

Inactive departments remain visible in records and plan history. Staff can reactivate them in Department settings. Inactive departments are unavailable for new student or position selections, new drafts, publication, and new assignments.

## Assign a plan to students

Select the department and a published version in **Assign curriculum**. Search by name or academic ID and select students across pages. Review the department, version, and student list before submitting.

The API checks every selected student against the plan's department and existing assignments. It saves the full batch together or rejects it. If someone was transferred or assigned after selection, refresh the list and review the selection again. Each assignment stores who made it and when.

The student profile links to the exact assigned version. Later publications and department transfers leave that assignment in place. CSV import is deferred.

## Faculty positions and database migration

The shared department directory also serves **Administration → Faculty positions**. Position managers use an active department picker when adding a position and can choose **Faculty-wide** for an office with no department. The picker uses the existing faculty position management permission.

Migration `0012_curricula` adds department and curriculum storage. Migration `0013_department` backfills the directory from existing faculty position department codes, links positions by that stable code, and introduces draft and publication state. Existing curriculum versions become published and retain their IDs and assignments. Existing department codes continue to support workflow routing, including for inactive departments. Legacy students without a department remain unassigned to a department until staff updates their profiles.

See the [Department API reference](API.md) and the [Student Affairs guide](../student-affairs/README.md).
