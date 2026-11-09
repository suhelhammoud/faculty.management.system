# Identity and access

## Shared sign-in foundation

- The application has one shared sign-in and session across its modules.
- Accounts are managed by the application through Better Auth (a technology note, subject to confirmation).
- Employee accounts with different roles and student accounts are required.
- An administrator exists, but the administrator's specific powers are not defined here.
- Google account linking is deferred.

## Employee accounts

Who creates employee accounts, assigns roles, activates accounts, and handles recovery remains open. Employee role names, role scope, and permission assignment are also undecided. A general dynamic role model is a technical direction in the source notes, not a settled policy.

## Student accounts

- Authorized Student Affairs staff can create student accounts using the student's mobile number.
- A student normally activates an account once using a Telegram one-time code and sets a password.
- Later sign-in uses mobile number and password.
- If Telegram delivery fails, authorized Student Affairs staff can verify identity and activate the account manually. The system records the exception and action and issues a temporary password; the student changes it after first sign-in.
- Authorized Student Affairs officers handle student password recovery, using the temporary-password path. Auditing recovery is proposed and needs confirmation.

## Access boundaries

The general role model is separate from the minimum permissions needed for authorized staff actions in the shared foundation. The milestone requires those actions to be restricted to authorized staff, but does not settle role names, assignment, or a complete permission matrix.

## Open decisions

- Who creates employee accounts, assigns roles, and handles employee activation and recovery?
- How are student identity verification and authorization for account creation, manual activation, and recovery defined?
- What events and details are recorded for manual activation and recovery, who can review them, and how long are they retained?
- Must a student change a temporary password before reaching the signed-in home? This is a proposed acceptance check, not a confirmed requirement.
- What account protections, session behavior, and recovery controls are required?
