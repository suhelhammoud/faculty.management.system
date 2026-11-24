# Department API

Department routes use `/api/department` and require an active session. Writes require a browser origin listed in the API's `TRUSTED_ORIGINS`. IDs are UUIDs.

Read routes require `student-affairs:read`. Management routes require `student-affairs:administer`, including the student list used for bulk assignment.

| Method and path                       | Access | Behavior                                                                                                                                                               |
| ------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`                               | Read   | List departments, including inactive entries.                                                                                                                          |
| `POST /`                              | Manage | Create a department from `{ code, name }`. Codes are unique and immutable.                                                                                             |
| `PATCH /:id`                          | Manage | Update a department with `{ name, active }`.                                                                                                                           |
| `GET /:id/curricula`                  | Read   | List the department's draft and published versions.                                                                                                                    |
| `GET /curricula/:id`                  | Read   | Read a specific version and its modules.                                                                                                                               |
| `POST /curricula`                     | Manage | Create a plan and its first draft with `{ departmentId, name, modules }`.                                                                                              |
| `POST /curricula/families/:id/drafts` | Manage | Open the existing draft or create the next one from the latest published version. The path ID identifies the plan family.                                              |
| `PATCH /curricula/:id`                | Manage | Replace a draft's name and module list with `{ name, modules, expectedRevision }`.                                                                                     |
| `POST /curricula/:id/publish`         | Manage | Publish a draft with `{ expectedRevision, allowEmptySemesters }`.                                                                                                      |
| `GET /:id/students`                   | Manage | List students in a department and their curriculum assignment summaries. Accepts `search` and `page` and returns `{ records, total }` with up to 50 students per page. |
| `POST /assignments`                   | Manage | Assign a published version with `{ planId, studentIds }` and return `{ assigned }`. Send 1–500 distinct student IDs.                                                   |

The plan title is stored as `name`. Plan creation and draft updates accept optional `description`, `adoptionDate` (`YYYY-MM-DD`), `ministryDecision`, and `remarks`. Send `null` to clear a field. Version details return these fields. New drafts copy the description and remarks, with the adoption date and ministry decision blank for the new version.

A plan family ID stays stable across revisions. A version's `id` is different from its `familyId`. Use the version ID for `planId` in an assignment. Versions report their `version`, `revision`, and `publishedAt`. A null `publishedAt` indicates a draft. Successful edits advance the draft revision, and stale edits or updates to published versions return `409`.

A module takes `studyYear` (1–5), `semester` (1–2), `code`, `name`, `theoryHours`, `labHours`, `credits`, and `requirement` (`required` or `elective`). The hours are weekly integers from 0 to 80 and credits are integers from 0 to 100 or null when unspecified. `name` is the English module name. Optional `nameAr` stores the Arabic name. Optional `theoryMarks`, `practicalMarks`, `totalMarks`, and `progressMarks` each accept an integer from 0 to 100 or null. A draft can have up to 500 modules. Publication requires at least one module, and publishing with empty semesters requires `allowEmptySemesters: true`.

Assignment is transactional. Missing, already assigned, or out-of-department students cause a `409` and leave the batch unapplied. New assignments require an active department and a published version. The audit log records `department:assign-curriculum` with the actor, plan version ID, and selected student IDs.

The [Student Affairs API](../student-affairs/README.md#staff-api) owns student department changes and exposes the assigned version on profile reads. `GET /api/admin/faculty-positions/departments` provides active department codes and names to callers with `faculty-positions:manage`. Position creation accepts the selected `departmentCode`, or null for faculty-wide positions.
