# Student Affairs System

## Purpose

Manages student applications, enrollment, academic records, certificates, and status.

## Users and workflows

The Student Affairs workspace is available at `/student-affairs` in English and Arabic. It supports the student registry, annual records, staff assignments, and dean-issued promotion grants. Student account activation and recovery are proposed separately. [Identity and access](../../identity-and-access.md)

## Permissions and dependencies

| Role                             | Permission                                           | Access                                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student Affairs staff            | `student-affairs:read`                               | Read every student and annual record. Create and edit records within assigned study years.                                                               |
| Designated Student Affairs admin | `student-affairs:read`, `student-affairs:administer` | Write across all years, manage staff year assignments, and classify legacy students. Moving a student between assigned years requires a live dean grant. |
| Dean                             | `student-affairs:grant-promotions`                   | List, issue, and revoke promotion grants.                                                                                                                |

Staff can cover several years, and several staff can cover the same year. Profile writes follow the student’s current year. Annual record creation follows the student’s current year and the staff member’s assignment. Historical remarks follow the year on the annual record. The admin can backfill annual records and correct their recorded study year.

## Department and curriculum

Choose an active department on the student creation or edit form. Normal profile write permissions apply. Profiles show the student's current department and link to the exact assigned curriculum version, including when that plan belongs to a former department. Assign curricula in the [Department workspace](../department/README.md).

## Staff API

All paths are relative to `/api/student-affairs`. Requests require an active session. Writes require a trusted browser origin through the shared origin protection.

| Method and path                                            | Behavior                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /capabilities`                                        | Return the caller’s registry, administration, and dean permissions and assigned study years. Requires an active session.                                                                                                                                                                                   |
| `GET /students`                                            | Search academic IDs or any component of a student’s name with `search`. Filter with `studyYear=1` through `5` or `studyYear=unassigned`. Returns `{ records, total, page, pageSize }` with IDs, names, and current study year. `page` defaults to 1 and `pageSize` to 20, with a maximum page size of 100. |
| `POST /students`                                           | Create a student with `academicId`, `firstName`, `fatherName`, `lastName`, and `currentStudyYear`. Optional profile fields include contact, civil registry, and admission details.                                                                                                                         |
| `GET /students/:studentId`                                 | Read the student’s profile and admission details.                                                                                                                                                                                                                                                          |
| `PATCH /students/:studentId`                               | Edit supplied profile fields with `expectedRevision` from the profile. Use `null` to clear optional fields.                                                                                                                                                                                                |
| `PUT /students/:studentId/current-study-year`              | Send `{ currentStudyYear, expectedRevision }` with study year 1–5. The admin can classify a student with a missing year directly. Changes between assigned years require a live dean grant and preserve annual history.                                                                                    |
| `GET /students/:studentId/academic-years`                  | List basic annual records.                                                                                                                                                                                                                                                                                 |
| `POST /students/:studentId/academic-years`                 | Add `{ academicYear, year, remarks? }`. New academic periods use consecutive `YYYY-YYYY` years.                                                                                                                                                                                                            |
| `PATCH /students/:studentId/academic-years/:academicYear`  | Update `remarks`. The admin can also correct `year`.                                                                                                                                                                                                                                                       |
| `GET /staff-year-assignments`                              | List staff and assigned years for the admin.                                                                                                                                                                                                                                                               |
| `PUT`, `DELETE /staff-year-assignments/:userId/:studyYear` | Grant or revoke one year. Repeating the request is safe.                                                                                                                                                                                                                                                   |
| `GET /promotion-grants`                                    | List promotion grants for the dean, including expired and revoked grants.                                                                                                                                                                                                                                  |
| `POST /promotion-grants`                                   | Issue a grant with `{ userId, expiresAt }` to the active Student Affairs admin. `expiresAt` is an ISO timestamp with a time zone.                                                                                                                                                                          |
| `GET /promotion-grants/recipients`                         | List eligible admin names and account IDs. Requires the dean permission.                                                                                                                                                                                                                                   |
| `GET /promotion-grants/current`                            | Return `{ grant }` for the signed-in Student Affairs admin. An absent live grant is represented as `null`.                                                                                                                                                                                                 |
| `DELETE /promotion-grants/:grantId`                        | Revoke a grant immediately. Repeating a revocation is safe.                                                                                                                                                                                                                                                |

A promotion grant takes effect on issuance, covers the whole registry, and allows repeated moves until expiry or revocation. The dean can issue one live grant per admin at a time. The audit log records profile and annual writes, staff assignment changes, and grant issuance and revocation. Year changes record the prior and new year and the grant ID when applicable. The audit entries store identifiers and action metadata.

Invalid requests return `400`, insufficient access returns `403`, missing records return `404`, and duplicate academic IDs, annual periods, or live grants return `409`. Dates use `YYYY-MM-DD`; scores use decimal strings. The recorded `adjustedScore` is read-only until its calculation is agreed. The annual API exposes only period, study year, remarks, and timestamps.

Student create and patch requests accept an optional `departmentId`. Use an active department's UUID, or `null` to clear the student's department. Profile reads include `departmentId`, `departmentName`, and `curriculum`. The latter contains the assigned version's `id`, `name`, `version`, and `departmentName`, or is null. Changing `departmentId` preserves any existing curriculum assignment.

Profile responses include an integer `revision`. Profile and current-year writes supply it as `expectedRevision`. Each successful change advances the revision. A stale write returns `409` with code `STUDENT_REVISION_CONFLICT`. Reload the record and review the draft before retrying. Existing student records start at revision 1 after the migration.

## Deployment

Apply the Drizzle migration and run `pnpm --filter @project/db seed:permissions`. Use shared Administration to grant `student-affairs:read` to staff, both read and administer to the designated admin, and `student-affairs:grant-promotions` to the dean. A platform administrator can manage those role assignments through existing Administration. The default platform Administrator role receives Student Affairs permissions only through explicit assignment. [Shared authorization](../authorization/README.md)

## Local demo

After applying migrations to a local database, set `SEED_USER_PASSWORD` in `packages/db/.env` and run `pnpm --filter @project/db seed:local`. The seed creates `DEMO-STA-001` through `DEMO-STA-005`, one synthetic student in each study year. It adds six annual records, including a Year 1 history row for `DEMO-STA-002`, whose current study year is 2. [Local seed setup](../../../packages/db/src/seed/README.md#student-affairs-demo)

| Username          | Access                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `sta_admin`       | Manage records across all five years and assign staff. Moving a student between assigned years requires a dean grant. |
| `sta_dean`        | Issue and revoke promotion grants.                                                                                    |
| `sta_staff_one`   | Read all students and write in Years 1 and 2.                                                                         |
| `sta_staff_two`   | Read all students and write in Years 2 and 3.                                                                         |
| `sta_staff_three` | Read all students and write in Years 4 and 5.                                                                         |

All demo accounts use the configured seed password. Start the API and web app, then open `/student-affairs`. Use separate browser sessions or sign out between roles.

1. Sign in as `sta_staff_three`. Search for `DEMO-STA-002` and open its profile and **Annual records**. The profile is readable and its current Year 2 is outside this staff member’s edit scope.
2. Sign in as `sta_admin`. Open **Staff assignments** to see that two staff share Year 2. On the student profile, **Change study year** shows the grant status. A fresh seed starts with no active grant.
3. Sign in as `sta_dean`. In **Promotion grants**, choose the Student Affairs admin and a future expiry. Review the displayed deadline and confirm the grant.
4. Return to `sta_admin`, choose Year 3 on the student profile, and confirm the move. The annual records retain their original years. `sta_staff_two` can now edit the profile, and both Year 2 staff can still edit remarks on the Year 2 annual row.
5. As `sta_dean`, revoke the grant and confirm. The admin can use **Refresh grant status** to check immediately. Moves between assigned years are unavailable until the dean issues another grant.

Rerunning the local seed preserves existing student and annual record edits, staff year assignment changes, and promotion grants, including revocations.

## Student data schema

The student and annual tables were created by `packages/db/drizzle/0000_brown_sandman.sql`. Migration `packages/db/drizzle/0004_student_affairs_access.sql` adds student names, current study year, staff assignments, and promotion grants.

### Core student record

The `students` table uses a generated UUID `studentId` as its primary key. `academicId` is a required, unique institutional identifier. `userId` is an optional, unique reference to `auth_user.id`, allowing a student record to be linked to at most one shared login account without requiring every student to have an account. Both tables include `createdAt` and `updatedAt` timestamps.

The listed date fields use PostgreSQL `date`; score and fee fields use `numeric`; other fields use `text` where their format is not defined. Fields not otherwise marked required are nullable in the current schema.

The supplied source excerpt begins partway through row 5. The first entry below uses the identified field name `birthPlace` and the visible description. Rows 1–4 and the missing portion of row 5 still need confirmation against the complete source.

| Field                    | English meaning                                                                                   | Arabic meaning                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `studentId`              | Generated internal identifier and primary key.                                                    | —                                                          |
| `academicId`             | Required unique institutional student identifier.                                                 | —                                                          |
| `firstName`              | Student’s given name. Required for new records.                                                   | الاسم                                                      |
| `fatherName`             | Student’s father’s name. Required for new records.                                                | اسم الأب                                                   |
| `lastName`               | Student’s family name. Required for new records.                                                  | اسم العائلة                                                |
| `currentStudyYear`       | Current study year from 1 to 5. Legacy records may be unassigned.                                 | السنة الدراسية الحالية                                     |
| `userId`                 | Optional unique reference to the student's shared sign-in account.                                | —                                                          |
| `birthPlace`             | City or location where the student was born.                                                      | محل الولادة                                                |
| `birthDate`              | Student's date of birth.                                                                          | تاريخ الولادة                                              |
| `motherName`             | Student's mother's full name.                                                                     | اسم الأم                                                   |
| `civilRegistryPlace`     | Place where the student is registered in the civil registry.                                      | محل القيد في السجل المدني                                  |
| `civilRegistryNumber`    | Student's civil registry registration number.                                                     | رقم القيد في السجل المدني                                  |
| `nationality`            | Student's nationality.                                                                            | الجنسية                                                    |
| `governorate`            | Student's governorate of residence or origin.                                                     | المحافظة                                                   |
| `permanentAddress`       | Student's permanent residential address.                                                          | العنوان الدائم                                             |
| `homsAddress`            | Student's residential address in Homs.                                                            | العنوان في حمص                                             |
| `mobileNumber`           | Student's mobile phone number.                                                                    | رقم الموبايل                                               |
| `phoneNumber`            | Student's telephone number.                                                                       | رقم الهاتف                                                 |
| `email`                  | Student's email address.                                                                          | عنوان البريد الإلكتروني                                    |
| `enrollmentDate`         | Date the student joined the faculty.                                                              | تاريخ الالتحاق بالكلية                                     |
| `secondaryCertificate`   | Secondary school certificate used for admission to the faculty.                                   | الشهادة الثانوية التي قُبل الطالب بموجبها                  |
| `certificateType`        | Type or category of the secondary school certificate.                                             | نوع الشهادة الثانوية                                       |
| `certificateDate`        | Date the secondary school certificate was obtained.                                               | تاريخ نيل الشهادة الثانوية                                 |
| `gradeAverage`           | Average grade achieved in the secondary school certificate.                                       | معدل العلامات                                              |
| `equivalencyDecision`    | Foreign certificate equivalency decision, including its reference number and date, if applicable. | قرار تعادل الشهادة الأجنبية، بما في ذلك رقم القرار وتاريخه |
| `totalScore`             | Total score achieved in the secondary school certificate.                                         | مجموع الدرجات                                              |
| `adjustedScore`          | Total score excluding specified subjects or components (to be defined later).                     | مجموع الدرجات باستثناء (يُحدد لاحقاً)                      |
| `language`               | Student's recorded language.                                                                      | اللغة                                                      |
| `gender`                 | Student's gender.                                                                                 | الجنس                                                      |
| `examRegistrationNumber` | Registration number for the secondary school examination.                                         | رقم الاكتتاب في الشهادة الثانوية                           |
| `notes`                  | Additional remarks or administrative notes about the student.                                     | ملاحظات إضافية أو إدارية حول الطالب                        |

### Student academic-year record

The `student_academic_years` table references `students.studentId`. Its composite primary key `(studentId, academicYear)` allows one row per student per academic period; a student may have records for multiple academic years. `year` is the student's study level for that period and uses a PostgreSQL `smallint`.

| Field                      | English meaning                                                | Arabic meaning                      |
| -------------------------- | -------------------------------------------------------------- | ----------------------------------- |
| `studentId`                | Reference to the core student record; part of the primary key. | الرقم التعريفي للطالب               |
| `year`                     | Student's study year (first, second, third, etc.).             | السنة الدراسية للطالب               |
| `academicYear`             | Academic period, such as 2026–2027; part of the primary key.   | العام الدراسي                       |
| `firstTermFee`             | Tuition fee amount for the first semester.                     | رسوم الفصل الدراسي الأول            |
| `firstTermReceiptNumber`   | Payment receipt number for the first semester.                 | رقم إيصال دفع رسوم الفصل الأول      |
| `firstTermReceiptDate`     | Payment receipt date for the first semester.                   | تاريخ إيصال دفع رسوم الفصل الأول    |
| `secondTermFee`            | Tuition fee amount for the second semester.                    | رسوم الفصل الدراسي الثاني           |
| `secondTermReceiptNumber`  | Payment receipt number for the second semester.                | رقم إيصال دفع رسوم الفصل الثاني     |
| `secondTermReceiptDate`    | Payment receipt date for the second semester.                  | تاريخ إيصال دفع رسوم الفصل الثاني   |
| `certificateReceiptNumber` | Receipt number associated with receiving the certificate.      | رقم إيصال استلام الشهادة            |
| `certificateReceiptDate`   | Date of the certificate receipt.                               | تاريخ إيصال استلام الشهادة          |
| `firstTermResult`          | Student's examination result for the first semester.           | نتيجة امتحانات الفصل الدراسي الأول  |
| `secondTermResult`         | Student's examination result for the second semester.          | نتيجة امتحانات الفصل الدراسي الثاني |
| `remarks`                  | Additional academic or administrative remarks.                 | ملاحظات إضافية                      |

## Open decisions

- What application, enrollment, certificate, and status workflows should follow the staff registry?
- Which records can students view or update in a future self-service API?
- What student identifiers and data may be shared with other modules, and under what rules?
- What are the missing early fields from the original source excerpt?
- Does `governorate` describe residence or origin, and what does `language` represent?
- What should `secondaryCertificate` capture, and should `equivalencyDecision` group its reference number and date or store them separately?
- Which subjects or components are excluded from `adjustedScore`, how is it calculated, and who supplies or confirms the value?
- Does Exams own the term results? If so, does Student Affairs reference them or keep a copy, and how are corrections reflected?
- Who owns term fee and receipt data, and what validation applies to amounts and payment evidence?
- Which certificate and handover does the certificate receipt document, and do its number and date belong in the academic-year record or a separate certificate workflow?
- Should a student account link be required by a future account-provisioning workflow? It is optional in the schema currently.
