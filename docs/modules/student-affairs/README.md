# Student Affairs System

## Purpose

Manages student applications, enrollment, academic records, certificates, and status.

## Users and workflows

Student Affairs staff and students are implied by the subject. Application, enrollment, record, certificate, and status workflows are open. Authorized Student Affairs staff also perform the student account actions described in [identity and access](../../identity-and-access.md).

## Permissions and dependencies

No module-specific permissions or data contracts are defined. Shared sign-in and access are described in [identity and access](../../identity-and-access.md). This module may provide student context to other modules, but any such sharing is undecided.

## Student data schema

The supplied fields map to two Drizzle tables in `packages/db/src/schema/student-affairs/`, exported through the shared database schema. The schema is implemented in migration `packages/db/drizzle/0001_wandering_ultimates.sql`.

### Core student record

The `students` table uses a generated UUID `studentId` as its primary key. `academicId` is a required, unique institutional identifier. `userId` is an optional, unique reference to `auth_user.id`, allowing a student record to be linked to at most one shared login account without requiring every student to have an account. Both tables include `createdAt` and `updatedAt` timestamps.

The listed date fields use PostgreSQL `date`; score and fee fields use `numeric`; other fields use `text` where their format is not defined. Fields not otherwise marked required are nullable in the current schema.

The supplied source excerpt begins partway through row 5. The first entry below uses the identified field name `birthPlace` and the visible description. Rows 1–4 and the missing portion of row 5 still need confirmation against the complete source.

| Field                    | English meaning                                                                                   | Arabic meaning                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `studentId`              | Generated internal identifier and primary key.                                                    | —                                                          |
| `academicId`             | Required unique institutional student identifier.                                                 | —                                                          |
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

- What application, enrollment, academic-record, certificate, and status workflows are in scope?
- Which records can students view or update, and which staff actions need authorization?
- What student identifiers and data may be shared with other modules, and under what rules?
- What are the missing early fields from the original source excerpt?
- Does `governorate` describe residence or origin, and what does `language` represent?
- What should `secondaryCertificate` capture, and should `equivalencyDecision` group its reference number and date or store them separately?
- Which subjects or components are excluded from `adjustedScore`, how is it calculated, and who supplies or confirms the value?
- Does Exams own the term results? If so, does Student Affairs reference them or keep a copy, and how are corrections reflected?
- Who owns term fee and receipt data, and what validation applies to amounts and payment evidence?
- Which certificate and handover does the certificate receipt document, and do its number and date belong in the academic-year record or a separate certificate workflow?
- Should a student account link be required by a future account-provisioning workflow? It is optional in the schema currently.
