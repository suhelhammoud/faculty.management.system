# Exam System

Manages examination marks, results approval, and certification reports.

This is a starting specification for the Exams module in the shared university application. It adapts the [Exam Management System requirements draft](../../resources/Exam_Management_System_Requirements_English.docx), which describes a standalone graduation project. Shared sign-in, account creation, activation, and recovery follow [identity and access](../../identity-and-access.md); this module does not define a separate account system. Requirements below retain the source's evidence status: **Interview-supported** means the interview is cited as support; **Inferred** means the source derives the behavior from the described workflow; **Proposed** means stakeholder approval is still needed. None of these labels makes policy final.

## Core workflow

1. **Import students and courses; prepare eligibility.** File import, column preview, duplicate and missing-value checks, and row-level results are **Inferred**. The interview supports including new students, students carrying courses, practical retakes, and students with suspended registration according to status (**Interview-supported**). The system could prepare a course list with a reason for each inclusion or exclusion (**Inferred**); eligibility rules and exceptional additions require office decisions.
2. **Assign exam numbers and rooms.** Generating session-specific examination numbers and allocating eligible students to rooms are **Interview-supported**. Public room lists without seat numbers and internal lists with seat numbers are also described as **Interview-supported**. Random allocation, capacity handling, approval of published lists, and versioning when lists change are workflow details marked **Inferred** or **Proposed** in the source; confirm the operating rules.
3. **Receive practical marks.** The interview supports a practical-instructor file, an appeal, committee review, and a signature when a mark changes (**Interview-supported**). Manual entry, file validation, source tracking, completeness checks, and batch exceptions are **Inferred**. Appeal handling beyond recording a request needs approved policy.
4. **Import and reconcile theoretical marks.** The interview supports room allocation, a scanner file, reconciliation and verification, followed by export of university ID and mark (**Interview-supported**). Matching scanner rows to examination numbers, identifying duplicate, unknown, or missing numbers, and recording resolutions against paper evidence are **Inferred**. Do not infer a student's identity when a scanner row cannot be matched.
5. **Verify, approve, publish, and export.** A working sequence of reconciliation, verification, director approval, and results publication/export is supported by the described workflow (**Interview-supported**). Calculating totals, checking conflicts and absences, locking results, and preserving an export record are **Inferred**. Continue file export for “Jamiati” and official printouts; direct integration with Jamiati is not assumed. The grading scale, passing rules, and practical/theoretical weighting must come from academic decisions, not this requirements draft.

## Candidate roles and scoped permissions

The role model and limits below are **Proposed** in the requirements source. They describe an exam-module permission starting point, not confirmed university roles or a replacement for shared account and role administration. Permission assignment, named roles, delegation, and approval coverage remain open. Limit access by assigned course, year, session, and result state where applicable; deny actions outside an approved scope.

| Candidate role | Proposed scope and actions |
| --- | --- |
| Instructor or practical instructor | Enter or upload marks for assigned courses; review assigned appeals; request a justified correction. No access to student identity behind an anonymity code unless a separately authorized process permits it. |
| Year administrator | Prepare lists and rooms, reconcile scanner marks, review exceptions and absences, verify results, and export after approval, within assigned-year scope. A student carrying a course from another year may appear on that course list without widening general access. |
| Examinations Director | Review exceptions and authorization requests, approve publication, and view audit records across years. A mark change still follows a separately authorized correction process. |
| Scanner operator | Supply a scanner file for a specific batch; no final-mark approval. This is a proposed access limit. |
| Student and appeals committee | Student viewing and direct requests, and committee handling, are phased additions. Until then, a request may be recorded by an employee on the student's behalf. Decision authority and procedures require confirmation. |

The source proposes separation of duties: a requester does not approve their own correction, and the mark editor is not the final reviewer of that change. Any exception for limited staffing, an alternate approver when the Director is unavailable, and conflict-of-interest handling require an approved procedure.

## Mark lifecycle and audit trail

The source's lifecycle is a **working model inferred from the interview-supported workflow**: draft → submitted by instructor or scanner → reconciled → verified by year administrator → approved by Director → published or exported. The exact status names, lock point, and responsibility for each transition are open.

Versioning, retaining the prior approved result, and recording actor, time, source, reason, and before/after values for sensitive changes are **Inferred** from the requirements draft's integrity and traceability needs. Withholding is described as separate from the calculated mark (**Inferred**); the competent authority, grounds, and rules for lifting it remain open. Do not silently replace an approved import or result.

### Proposed temporary correction authorization

Correction after locking through narrow, temporary authorization is **Proposed**, not settled policy. The source suggests a request that identifies the student, course, semester, mark, reason, evidence, current and requested values, and editor; Director review with a recorded decision; and authorization limited to one person and one mark (or another explicitly narrow scope), short-lived, and single-use. Expiry, revocation, unchanged-original checks, conflict checks, before/after audit, re-verification, and re-approval are also proposed mechanics. A correction should not republish automatically. Bulk correction needs a separate approved process.

Confirm whether to adopt this mechanism, who may request and approve, what evidence is required, whether one request may cover multiple marks, duration, exceptions, retention, and how corrected results are sent to Jamiati.

## Phased extensions

The requirements source proposes a core release followed by useful extensions. This is a source proposal only; it does not set the shared application's module priority or delivery commitment.

- **Possible core scope:** student/course import, eligibility lists, examination numbers and rooms, practical-mark intake, scanner import and reconciliation, verification, Director approval, Jamiati file export, printouts, and audit history. Account creation and role assignment remain governed by the shared identity spec.
- **Possible later scope:** appeals workflow and committee decisions; violations and result withholding; a student interface for room/result viewing, appeals or inquiries, and transcript requests. The source proposes recording requests through staff before a student interface exists. Rules for violations, appeals, notification, payment, and disclosure are unresolved.
- **Anonymity option:** entering written-theory marks by anonymity code with a separate authorized de-anonymization role is an **Option pending approval**. Whether instructors may see names, who controls the mapping, and when it may be revealed are open.

## Data boundaries and dependencies

- Shared identity and access are defined in [identity and access](../../identity-and-access.md). Exam assignments and scoped permissions remain module-specific decisions; do not duplicate account activation or recovery rules here.
- The workflow needs student and course information, semester and course registration/eligibility context, exam sessions, rooms and seats, examination numbers, practical marks, scanner batches, results, exceptions, and export records. The requirements source infers file-based student/course import. The authoritative systems, format, ownership, refresh cadence, and correction process are not decided.
- Anonymity codes, examination numbers, student names, and university IDs are distinct identifiers. The source proposes separately restricting mappings to student identity; access and retention rules need approval.
- The source describes export files for Jamiati and printable records. Direct Jamiati integration is a possible later extension only if its interface and owner permit it. No data contract with Student Affairs or another module has been established.

## Candidate acceptance checks

These are observable checks for review, not approved policy. Checks based on derived mechanics are marked **Inferred**; choices called out by the source as proposals remain **Proposed**.

- **Inferred:** An import preview reports accepted and rejected rows, including duplicate or missing data, with a reason for each rejected row.
- **Interview-supported / Inferred:** A course eligibility list can represent new students, course carriers, practical retakes, and registration status; the system displays the applied reason and leaves rule selection to approved office policy.
- **Interview-supported:** A session list assigns examination numbers and rooms and can produce the described public and internal list variants. Capacity, randomization, and list-publication checks await policy confirmation.
- **Interview-supported / Inferred:** Practical-mark submissions retain their source and status; scanner reconciliation exposes unmatched, duplicate, and missing numbers for review rather than silently assigning identity.
- **Inferred:** The year administrator can verify marks and exceptions before submission for Director approval; unresolved conflicts block approval if that proposed control is accepted.
- **Interview-supported / Inferred:** After approval, a university-ID-and-mark file can be exported for Jamiati and a printable results sheet produced. The export records its version and actor if the proposed traceability check is adopted; no direct integration is implied.
- **Proposed:** A locked-mark correction requires an approved narrow authorization, records before/after values and evidence, expires or is consumed as configured, and returns the result for verification and approval without automatic republication.
- **Proposed extensions:** Appeal decisions and withholding actions are traceable, with no automatic penalty decision; student-facing access is added only after its privacy and workflow rules are approved.

## Open decisions

- Which official sources and office-approved rules determine eligibility, retakes, carried courses, suspensions, and exceptional additions?
- What are the authoritative student/course import formats, identifiers, owners, update timing, and data-sharing boundaries?
- What are the grading, weighting, absence, lock, publication, and correction rules for each course and semester?
- Which candidate roles and scopes are approved? Who can verify or approve when there is absence or conflict of interest?
- Are anonymity codes required for written marks, and who may access the identity mapping?
- Will temporary correction authorization be adopted? What limits, approvals, evidence, duration, audit retention, and bulk-correction process apply?
- Who decides appeals and violations, what evidence and signatures are required, and what may students see or request?
- What file formats, columns, and correction procedures does Jamiati require? Is any direct integration feasible and authorized?
- What privacy, retention, backup, availability, and Arabic/right-to-left interface requirements apply?
