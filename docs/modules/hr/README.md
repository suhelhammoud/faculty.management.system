# HR Management System

## Purpose

Manages employee records, administrative decisions, leave requests, and reports.

Employee self-service lets employees view the parts of their personnel file they are allowed to see, submit requests electronically, and track progress. HR and administrative office (Diwan) staff use the module to maintain records and process requests. The interview supports the functional scope below. Request types, approval steps, and other institutional procedures still need confirmation. [Employee Self-Service Requirements](../../resources/01-ذاتية%20موظفين/employee-self-service-requirements.md)

## Functional scope

| Workflow | Requirements | Source IDs |
| --- | --- | --- |
| Personnel files and employment history | Create and update employee files. Record appointment, start of work, end of service, and other employment changes. Link scanned decisions, letters, and supporting documents to the employee file or request. Show employment history to support issuing employment statements. Confirm the exact fields against the official form. | FR-01–FR-03, FR-12 · UC-01–UC-03 |
| Employee self-service | Let employees view permitted parts of their own file, submit requests with the required attachments, and track their status. Examples include leave, a leave statement, and statements confirming commencement of work or current employment. Confirm which request types to offer. | FR-05–FR-07 · UC-04, UC-05, UC-07 |
| Request review | Let the designated reviewer record the outcome and update the status according to the approved procedure. Approval, rejection, and requests for more information are example outcomes. | FR-08 · UC-06 |
| Search and reporting | Search, sort, and filter employee and request records by fields such as employee, specialization, request type, or date. Let authorized report users select fields and filters, for example to show an employee's leave for a given month. | FR-09–FR-11 · UC-08, UC-09 |
| Account and permission dependency | Use shared sign-in and shared role and permission administration. Confirm how personnel files are linked to employee accounts. | FR-04, FR-05 · UC-10 |

## Example leave request

1. The employee signs in and selects **Leave request**.
2. They enter the leave dates and type and attach any required documents.
3. The system checks completeness and saves the request with a reference number and an initial status.
4. The designated reviewer records an outcome under the institution's procedure. The employee can track the status, and the request record retains the decision.

## Access and data boundaries

- Employees can submit and track their own requests and view the permitted parts of their own file.
- HR or Diwan staff maintain personnel files, decisions, and requests within their assigned scope. A manager or another authorized official reviews requests where the institution's procedure calls for it. Report access also depends on authorization.
- Account creation, activation, recovery, and role administration follow [shared identity and access](../../identity-and-access.md). Ownership of the employee account lifecycle and the detailed HR permission matrix remain open.
- The module covers personnel files, employment events, administrative decisions, requests, and their attachments. Attachment storage and any data exchange with other modules remain open. Reports may be generated within the app or through an external tool connected to the database.

## Proposed controls

The source proposes access limited by role, secure attachment storage, required field and format validation, duplicate prevention where feasible, clear forms and search, support for adding request types, fields, and roles, and backup and recovery. It also proposes an audit log for sensitive changes with the actor, date, previous and new values, and a reason where needed.

**Optional temporary editing permission (UC-11).** An authorized user could request a limited edit to a sensitive record. A senior official would approve the request for a specific kind of change, for a limited time or a single use. Permission would expire automatically, and the request, approval, and edit would be logged. Adoption and the approval rules remain open.

## Preliminary demo scope and checks

The source proposes an initial demo with shared sign-in, basic roles, employee records and attachments, two or three request types, request review, search and filtering, and one or two reports with basic field and filter selection. Leave and a current employment statement are example request types. An advanced report designer or external reporting server integration can be considered later.

- HR staff can create a personnel file, record an employment change, and link an attachment. An employee can view the permitted parts of their own file.
- An employee can submit a complete leave request and receive a reference number. A designated reviewer can record an outcome, and the employee can see the status allowed by the agreed procedure.
- An authorized user can filter employee or request records and generate a report for a chosen period using selected fields.

## Open decisions

- Which fields, employment events, and administrative decisions belong in the official personnel file?
- Which request types and attachments are required? Who reviews each type, how many approval stages apply, and which statuses and details can employees see?
- Who may view or edit personal data? How are personnel files linked to shared employee accounts?
- Where should attachments be stored, and what access, audit, and recovery rules apply?
- Which reports, fields, and filters come first? Will reporting run in the app or through a separate tool?
- Should temporary editing permission be included in the initial scope? If adopted, who can approve it and what limits apply?
