# HR administration API

The API manages employee personal details, current employment information, and the reference lists used in HR forms. It is implemented in `apps/api/src/modules/hr/` under `/api/admin/hr`. Employee profiles may exist without an employment record or sign-in account.

## Access and setup

Apply migrations with `pnpm --filter @project/db migrate`, synchronize the permission catalog with `pnpm --filter @project/db seed:permissions`, and build with `pnpm --filter api build`. Fresh administrator bootstrap and local seeding provision the HR Administrator role. Assign it to users who need the role’s ongoing access. [Shared authorization guide](../authorization/README.md)

An approved, enabled shared administrator who has completed their password change can assign an HR user through the existing administration API:

1. Create and approve the user if necessary. The user must change their temporary password.
2. Find the HR Administrator role with `GET /api/admin/roles`.
3. Assign it with `POST /api/admin/users/:userId/roles`, sending `{"roleId":"hr-administrator"}` (use the actual returned role ID).

HR endpoints use shared session cookies. Browser clients must include `credentials: 'include'`. Every write must include an `Origin` allowed by `TRUSTED_ORIGINS`.

| Permission                | Operations                            |
| ------------------------- | ------------------------------------- |
| `hr-employees:read`       | Employee list and detail              |
| `hr-employees:create`     | Create profile                        |
| `hr-employees:update`     | Update profile and current employment |
| `hr-reference-data:read`  | Reference lists                       |
| `hr-reference-data:write` | Create/edit reference records         |

The three HR write permissions support global elevated grants. Employee and reference lists continue to require their read permissions. [Elevated grants](../authorization/README.md#elevated-grants)

## Employees

| Method | Path relative to `/api/admin/hr`    | Response                                         |
| ------ | ----------------------------------- | ------------------------------------------------ |
| GET    | `/employees`                        | `{ records, page, pageSize, total }`             |
| POST   | `/employees`                        | Created profile (201)                            |
| GET    | `/employees/:employeeId`            | Profile with `employment`, or `employment: null` |
| PATCH  | `/employees/:employeeId`            | Updated profile                                  |
| PUT    | `/employees/:employeeId/employment` | Current employment record                        |

Create a profile:

```json
{
  "employeeNumber": "EMP-001",
  "firstNameAr": "سارة",
  "lastNameAr": "حسن",
  "email": "sara@example.org"
}
```

Required fields are `employeeNumber`, `firstNameAr`, and `lastNameAr`. Employee numbers must be unique. Other supported fields are `middleNameAr`, `firstNameEn`, `middleNameEn`, `lastNameEn`, `birthDate`, `nationality`, `civilRegistryNumber`, `phoneNumber`, `mobileNumber`, `address`, `emergencyContactName`, `emergencyContactPhone`, and `notes`.

PATCH accepts any nonempty subset of personal fields. Omitted fields remain unchanged; set nullable fields to `null` to clear them. `userId`, generated IDs, and timestamps are not writable. Account IDs are excluded from responses.

Search and paginate with `search`, `categoryId`, `positionId`, `employmentStatus`, `page`, and `pageSize`. Search matches employee numbers and Arabic/English name fields, treating `%` and `_` as literal characters. Defaults are page 1 and page size 20; maximum page size is 100. Results sort by employee number then employee ID. Filters use current employment only. List records include names, employee number/ID, and an employment summary (record ID, category, position, department, status), excluding personal contact and identity details.

## Current employment

First create the relevant category and position using the reference endpoints. Submit their UUIDs:

```json
{
  "categoryId": "<category UUID>",
  "positionId": "<position UUID>",
  "employmentRegime": "Faculty staff",
  "startDate": "2026-01-01",
  "employmentStatus": "active",
  "department": "HR"
}
```

Required fields are `categoryId`, `positionId`, `employmentRegime`, and `startDate`. Optional fields are `academicRankId`, `gradeId`, `department`, `employmentStatus`, `endDate`, and `notes`. Dates use `YYYY-MM-DD`; end date must not precede start date. The position must belong to the category, and all referenced records must exist. Regime and status are free text; a new record defaults to `active`.

PUT replaces current employment details in place. Omitted nullable fields become `null`; an omitted status preserves the existing status or defaults to `active` on creation. The server manages `isCurrent` and serializes writes per employee. Older historical records remain untouched and are not exposed through this API. Leaving employment is recorded by updating status and end date; there is no employee delete endpoint.

## Reference lists

Each path supports GET (list), POST (create), and PATCH `/:id` (edit). Lists return arrays in stable code/rank/grade order, with UUID as a tie breaker. All IDs and timestamps are generated by the server.

| Path                 | Required create fields              | Optional fields                            |
| -------------------- | ----------------------------------- | ------------------------------------------ |
| `/staff-categories`  | `code`, `nameAr`                    | `nameEn`, `description`                    |
| `/positions`         | `categoryId`, `code`, `nameAr`      | `nameEn`, `isAcademic` (0 or 1, default 0) |
| `/academic-ranks`    | `code`, `nameAr`, `rankOrder` (1–5) | `nameEn`                                   |
| `/grade-schemes`     | `code`, `nameAr`                    | `nameEn`, `description`                    |
| `/employment-grades` | `schemeId`, `gradeNumber`           | `stepNumber`, `labelAr`, `labelEn`         |

Filter positions using `categoryId`, and grades using `schemeId`. Other filter/list combinations return 400. PATCH accepts a nonempty subset, preserving omitted fields. A position's category cannot change while employment records reference that position. Grade/step numbers must be positive small integers, and grade/step combinations are unique per scheme, including grades without a step. Reference records cannot be deleted through this API.

## Validation, errors, and auditing

Unknown input fields are rejected. Required text is trimmed and cannot be blank. Regular text is limited to 1,000 characters, notes to 10,000, and employee search to 200. Nullable fields accept `null`; blank strings should be replaced with `null` when clearing fields.

- 400: invalid payload, UUID, date, query, reference, or category/position relationship.
- 401: no valid session.
- 403: account not eligible, missing permission, or disallowed/missing Origin on a write.
- 404: employee or edited reference does not exist.
- 409: duplicate unique values or retryable concurrent database conflict.

Mutations write before/after values and the session actor to `hr_audit_log` within the same transaction. A failed audit write rolls back the data change. These records can contain sensitive personnel information; no audit-reading endpoint is exposed here.

## Verification

Run `pnpm --filter api test` for the automated suite. PostgreSQL integration tests are opt-in and truncate the public tables in the explicitly selected test database. Create a dedicated database ending in `_test`, then run:

```sh
HR_TEST_DATABASE_NAME=faculty_hr_api_test pnpm --filter api test
```

The test uses connection settings from `packages/db/.env.db` while replacing the database name. It applies migrations only to that test database. The API build and `pnpm --filter @project/db typecheck` check the TypeScript interfaces.
