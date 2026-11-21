# IT Faculty Management System — Project Context & Development Handover

> **Purpose:** Capture the project decisions and collaboration preferences for future development.
>
> **Last updated:** 21 November 2026
>
> **Source of truth:** The repository describes the current implementation. The [project overview](project-overview.md) maps the workspace and frontend routes.

## 1. Vision and intent

Build a unified **IT Faculty Management System** for a university faculty. The system digitizes academic and administrative processes, centralizes records, and supports staff, lecturers, supervisors, students, and administrators. Ten business domains share one platform.

The development experience should stay modular and maintainable, with strong TypeScript support and shared contracts. The API controls access by role, action, and individual record where the feature supports it.

## 2. Confirmed architectural decisions

- **Monorepo:** PNPM workspaces, with `apps/*` and `packages/*`.
- **Backend:** One NestJS API at `apps/api`, with domain modules and shared authentication and Workflows modules.
- **Frontend:** One **React + Vite + TypeScript** web app at `apps/web`. A shared React Router keeps the existing paths, and feature source lives under `apps/web/src/modules`.
- **Database:** PostgreSQL 17 locally in Podman, using **Drizzle ORM** and the `pg` driver.
- **Shared DB package:** `@project/db` contains schemas, migrations, and the database client. NestJS owns the pool, and the browser calls the API over HTTP.
- **Authentication:** Better Auth provides username login and cookie sessions.
- **Authorization:** NestJS enforces permissions, record-level access rules, and eligible elevated grants. The shared catalog uses keys such as `hr-employees:read`.
- **Development environment:** Fedora Linux, WebStorm, Codex CLI; Node, PNPM and Corepack were installed and checked.
- **Developer preference:** incremental, one-step-at-a-time instructions; provide shell commands in copyable code blocks. Use Codex as a _development assistant_, not as an autonomous implementer. Have Codex inspect/explain proposed edits and obtain approval before modifying code.

## 3. Ten faculty business modules

| Module          | Responsibility                                                       | Frontend route     |
| --------------- | -------------------------------------------------------------------- | ------------------ |
| Attendance      | Student attendance at lectures and academic activities               | `/attendance`      |
| Maintenance     | Repair workflows for faculty computers, printers, and equipment      | `/maintenance`     |
| Supervision     | Student projects, groups, supervisor meetings, and progress          | `/supervision`     |
| Meetings        | Staff availability and appointment booking                           | `/meetings`        |
| HR              | Employee records, decisions, requests, leave, and reports            | `/hr`              |
| Exams           | Marks entry, approvals, results, reports, and certification hand-off | `/exams`           |
| Correspondence  | Incoming and outgoing official correspondence                        | `/correspondence`  |
| Inventory       | Equipment custody, transfers, and stock                              | `/inventory`       |
| Student Affairs | Student applications, enrollment, records, and certificates          | `/student-affairs` |
| Facilities      | Registry of buildings, floors, rooms, and equipment locations        | `/facilities`      |

Administration (`/admin`) and shared Workflows (`/workflow/tasks`) also have their
own folders under `apps/web/src/modules`.

**Facilities naming note:** `Facilities` is the module name. Facilities manages
physical locations, Inventory manages custody and transfers, and Maintenance
manages repairs.

## 4. Repository layout

```text
faculty.management.system/
├── apps/
│   ├── api/                  # NestJS API on port 4000
│   └── web/                  # React and Vite app on port 3000
│       └── src/modules/      # Feature folders
├── packages/
│   ├── authorization/        # Permission catalog and role templates
│   ├── contracts/            # Shared request and response types
│   ├── db/                   # Drizzle schemas, migrations, and client
│   └── ui/                   # Shared React components
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

## 5. Frontend development and hosting

Run `pnpm dev` and open `http://localhost:3000`. Run `pnpm dev:api` for features
that need the API. The web app takes one `VITE_API_URL` and builds with
`pnpm build:web`. Module paths are preserved on the web origin. See the
[web app guide](../apps/web/README.md) for deployment and nested-route hosting.

## 6. Backend and database

PostgreSQL 17 runs locally in the `faculty-postgres` Podman container. The
API and database package read `DATABASE_URL` from
`packages/db/.env.db`. The shared `createDb(databaseUrl)` factory returns a
Drizzle client and a PostgreSQL pool. NestJS owns the pool through its database
module and closes it on shutdown. [Local database setup](../README.md#start-postgresql)

Start the API with `pnpm dev:api`. The `GET /health/database` endpoint
runs `SELECT 1` through the shared pool and returns `503` when the database
is unavailable. [Health check implementation](../apps/api/src/database/database-health.service.ts)

## 7. Authentication and authorization

Administration, HR, Facilities, and Inventory use the shared Better Auth
session. The web app displays account and sign-in states, and the API checks
approval, enablement, required password changes, and permissions on protected
requests. The Administration module at `/admin` manages users, roles,
record-level exceptions, and elevated grants. [Auth API setup](auth-api-setup.md) ·
[Shared authorization](modules/authorization/README.md)

## 8. Student Affairs domain notes captured earlier

The user previously translated paper registration documents into prospective system fields. These are **candidate domain requirements, not implemented database schemas**.

### Student Record (صحيفة الطالب)

Proposed names include `firstName`, `lastName`, `fatherName`, `fatherOccupation`, `birthPlace`, `birthDate`, `motherName`, `civilRegistryPlace`, `civilRegistryNumber`, `nationality`, `governorate`, `permanentAddress`, `homsAddress`, `mobileNumber`, `phoneNumber`, `email`, `enrollmentDate`, `secondaryCertificate`, `certificateType`, `certificateDate`, `gradeAverage`, `totalScore`, `adjustedScore` (placeholder: score excluding items to define later), `language`, `gender`, `examRegistrationNumber`, `notes`, and foreign certificate equivalency decision details (`equivalencyDecisionNumber`, `equivalencyDecisionDate`). These fields require review for types, constraints, privacy, normalization and exact Arabic terminology before implementation.

### Student Annual Record (السجل السنوي للطالب)

A suggested one-to-many annual record per student and academic year containing `studentId`, `year` (study level), `academicYear`, `firstTermFee`, `firstTermReceiptNumber`, `firstTermReceiptDate`, `secondTermFee`, `secondTermReceiptNumber`, `secondTermReceiptDate`, `certificateReceiptNumber`, `certificateReceiptDate`, `firstTermResult`, `secondTermResult`, and `remarks`.

**Ambiguity to resolve:** whether `certificateReceiptNumber`/`certificateReceiptDate` refer to collecting a certificate, or to a payment receipt related to the certificate. Do not silently decide. The proposed annual table names/types are provisional.

## 9. Development workflow and collaboration preferences

- Use **WebStorm** for IDE support, TypeScript refactoring and debugging.
- Use **Codex CLI** in WebStorm's terminal from the monorepo root; let the user remain in control of changes.
- For substantial tasks, ask Codex to **inspect → explain proposed changes → wait for approval → implement minimal approved changes → build/test → summarize**.
- When talking directly to the user, proceed **one step at a time**, with exact files and copy-pasteable commands/code blocks; wait for “done” or actual error output before proceeding.
- Avoid introducing unwanted frameworks (especially **Next.js**) or unapproved architectural changes.
- Preserve Git hygiene: ignore all nested `node_modules`, builds, `.env` files, IDE state and logs; commit `pnpm-lock.yaml` and useful `.env.example` templates.
- Centralized database migrations should live with `packages/db`; avoid connecting directly to PostgreSQL from the browser.

## 10. Follow-up work

1. Use the module specifications to confirm remaining domain requirements and coordinate shared records between Facilities, Inventory, and Maintenance.
2. Before production, configure web hosting, the API origin, operational monitoring, and backups. [Web deployment guide](../apps/web/README.md#build-and-host)

## 11. Suggested instruction to a new assistant

> I am developing the IT Faculty Management System documented in this file. Treat this as project context, but inspect the current repository before assuming any proposed code exists. My architecture is a PNPM monorepo with **one NestJS API**, **one React/Vite web app with feature folders**, **PostgreSQL/Drizzle** in `@project/db`, and **Better Auth with API-enforced authorization**. I work in **WebStorm with Codex CLI** and want **step-by-step guidance** with copyable commands and approval before major edits. Do not suggest Next.js. Continue from the latest verified state, rather than recreating work already done.
