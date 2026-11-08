# IT Faculty Management System — Project Context & Development Handover

> **Purpose:** Paste or attach this document at the start of a new ChatGPT/Codex conversation so the assistant can continue helping with this project without reconstructing prior decisions.  
> **Last updated:** 8 November 2026  
> **Source of truth:** The user's decisions and reported progress in the conversation. The assistant has **not independently inspected the current local repository**, so items described as reported/implemented require verification against the actual files when relevant.

## 1. Vision and intent

Build a unified **IT Faculty Management System** for a university faculty. The system digitizes academic and administrative processes, centralizes records, and supports staff, lecturers/supervisors, students and administrators as appropriate. It contains **ten distinct business domains**, but they work within a shared platform rather than ten disconnected backends.

The development experience should be modular and maintainable, with strong TypeScript support, shared contracts and data access, and authorization that can eventually control access by role, action, module and individual record.

## 2. Confirmed architectural decisions

- **Monorepo:** PNPM workspaces, with `apps/*` and `packages/*`.
- **Backend:** **one** NestJS API containing internal business modules for all ten subprojects; **not** ten separately deployed NestJS APIs.
- **Frontend:** **React + Vite + TypeScript**, **not Next.js**. Use **Module Federation** with one React Shell (host) and **ten independently deployable React remotes**. All eleven frontend applications are separate workspace projects.
- **Federation plugin:** `@module-federation/vite`; remote applications expose `./App` from `./src/App.tsx` through `remoteEntry.js`.
- **Database:** PostgreSQL 17 locally in Podman, using **Drizzle ORM** and the `pg` driver.
- **Shared DB package:** `@project/db`, owned by `packages/db`; only the backend should access database connections directly. Frontends communicate via HTTP APIs.
- **Authentication plan:** Better Auth (not yet confirmed implemented).
- **Authorization plan:** dynamic RBAC, permissions named `resource.action`, with NestJS guards/decorators; CASL may be introduced later for ownership/record-level policies. Avoid duplicating Better Auth authorization capabilities without evaluating them first.
- **Development environment:** Fedora Linux, WebStorm, Codex CLI; Node, PNPM and Corepack were installed and checked.
- **Developer preference:** incremental, one-step-at-a-time instructions; provide shell commands in copyable code blocks. Use Codex as a *development assistant*, not as an autonomous implementer. Have Codex inspect/explain proposed edits and obtain approval before modifying code.

### Changes from older attached architecture documents

The earlier `Architecture one - updated.md` described **nine modules and a single Next.js frontend**. Those portions are **superseded** by later explicit decisions: **ten modules**, **React/Vite**, **one shell + ten independently deployable federated remotes**. Preserve the useful parts of the old document such as the single NestJS API, `packages/db`, contracts and modular domain boundaries; do not reintroduce Next.js or the nine-module limitation.

## 3. Ten faculty business modules

| # | Short module | Project title | Responsibility | Frontend folder | Dev port |
|---|---|---|---|---|---|
| 1 | `Attendance` | Attendance System | Student attendance at lectures and academic activities | `apps/attendance` | 3001 |
| 2 | `Maintenance` | Asset Maintenance System | Maintenance requests for faculty computers, printers and equipment; track repair workflows | `apps/maintenance` | 3002 |
| 3 | `Supervision` | Supervision Tracker | Student projects, groups, supervisor meetings, documents and progress | `apps/supervision` | 3003 |
| 4 | `Meetings` | Meeting Booking System | Staff publish free slots and users book general appointments, not just supervision meetings | `apps/meetings` | 3004 |
| 5 | `HR` | HR Management System | Employee records, decisions, requests, leave and reports | `apps/hr` | 3005 |
| 6 | `Exams` | Exam System | Exam marks entry, approvals, results, reports and certification hand-off | `apps/exams` | 3006 |
| 7 | `Correspondence` | Correspondence System | Incoming/outgoing official correspondence | `apps/correspondence` | 3007 |
| 8 | `Inventory` | Asset Inventory System | Equipment assets assigned to employees and transfers between custodians | `apps/inventory` | 3008 |
| 9 | `StudentAffairs` | Student Affairs System | Student applications, enrollment, records, certificates, academic status | `apps/student-affairs` | 3009 |
| 10 | `Facilities` | **Provisional title:** Faculty Asset Registry System / Facilities Management System | Registry of buildings, floors, rooms, classrooms, labs, furniture and equipment locations | `apps/facilities` | 3010 |

**Facilities naming note:** `Facilities` was recommended and used as the module name, but the user had not finalized its longer project title. Avoid conflating Facilities (physical locations/registry), Inventory (asset custody/transfers), and Maintenance (repair workflows). Design shared identities and links between them when appropriate.

## 4. Intended repository layout

```text
faculty.management.system/
├── apps/
│   ├── api/                  # One NestJS backend (suggested port 4000)
│   ├── shell/                # React host (port 3000)
│   ├── attendance/           # Federated React remote (3001)
│   ├── maintenance/          # (3002)
│   ├── supervision/          # (3003)
│   ├── meetings/             # (3004)
│   ├── hr/                   # (3005)
│   ├── exams/                # (3006)
│   ├── correspondence/       # (3007)
│   ├── inventory/            # (3008)
│   ├── student-affairs/      # (3009)
│   └── facilities/           # (3010)
├── packages/
│   ├── db/                  # @project/db: Drizzle schemas, migrations, client
│   ├── contracts/           # Planned shared request/response contracts
│   └── ui/                  # Optional shared React components
├── pnpm-workspace.yaml
├── package.json
└── pnpm-lock.yaml
```

Backend business modules are intended under `apps/api/src/modules/`, with shared `auth/`, `authorization/`, and `database/` layers. The exact current directory contents should be inspected before making changes.

## 5. Frontend federation conventions and progress

**User-reported completed and verified:**

- Created React Shell and ten React/Vite remotes.
- Installed `@module-federation/vite` in the host and remotes.
- Configured each remote to expose `./App` and to share React and React DOM as singleton dependencies.
- Registered remotes in Shell `vite.config.ts`; set up lazy imports, navigation and TypeScript module declarations.
- Disabled automatic Module Federation DTS handling with `dts: false` after `@mf-types.zip` download warnings; manual `apps/shell/src/remotes.d.ts` declarations are used.
- Started applications, switched between remotes and explicitly reported **“All working”** for all ten.
- Added root PNPM scripts for starting individual remotes or all frontends and building individual frontends.

**Current local development URLs:** host `http://localhost:3000`; remotes `http://localhost:3001` through `http://localhost:3010`. The NestJS API was subsequently used at `http://localhost:4000`.

**Federation-specific naming:** `student-affairs` is the host import alias while its federation container `name` is `student_affairs`. Keep these in sync. Current URLs are hardcoded localhost addresses for development; for independent deployments, environment-specific remote URLs and deployment/version compatibility are still to be designed.

**Important limitation:** Independent applications are configured and running locally, but successful independent **production deployment** has not been verified. Also, keeping all Vite apps running is helpful for integration testing; a remote can be developed on its own when not interacting with the Shell.

## 6. Backend, database and PostgreSQL progress

### Database setup

- The user chose PostgreSQL and installed **Podman** because `docker` was not found on Fedora.
- Local container instructions used `faculty-postgres`, PostgreSQL 17, database `faculty_db`, user `faculty`, port `127.0.0.1:5432`, and named persistent volume `faculty-postgres-data`.
- Commands: `podman start faculty-postgres`, `podman stop faculty-postgres`, `podman ps -a`, and `podman exec faculty-postgres pg_isready -U faculty -d faculty_db`.
- Local development credentials were configured in `.env` during setup. **Do not put actual passwords or `.env` contents into shared context files, source control, or output logs.** The connection URL should be loaded from `DATABASE_URL`.

### `@project/db`

- Created `packages/db` and installed `drizzle-orm`, `pg`, `drizzle-kit`, `@types/pg`, `typescript`, and supporting tools; PNPM build-script approvals for `esbuild` were handled.
- Created `drizzle.config.ts`, `src/client.ts`, `src/schema/index.ts`, `src/index.ts`, and TypeScript configuration.
- The shared factory `createDb(databaseUrl)` returns `{ db, pool }` (Drizzle instance and PostgreSQL pool). One backend-managed pool should be reused; no database connection should be established simply from importing the package.
- `@project/db` linked into `apps/api` using `pnpm --filter ./apps/api add '@project/db@workspace:*'`.
- Initial DB TypeScript checking passed with `pnpm --dir packages/db exec tsc --noEmit --pretty false`.

### Codex architectural review and follow-up steps

Codex identified these issues in an initial read-only review:

1. `@project/db` initially exported TypeScript source at runtime; recommended compiling ESM JavaScript and `.d.ts` files to `dist/`, with package exports pointing there.
2. The DB library initially imported `dotenv/config`, while NestJS should own environment configuration.
3. The database provider initially existed but was not registered in NestJS.
4. Database lifecycle should ensure graceful shutdown of the shared PostgreSQL pool.
5. API and DB should have compatible ESM/NodeNext settings; TypeScript version consistency should eventually be checked.

Prompts were provided to Codex for implementing: (1) DB build/exports, (2) centralized NestJS config via `@nestjs/config`, (3) `DatabaseModule` plus lifecycle, and (4) end-to-end database health-check. **The conversation does not contain Codex's final implementation report for every step. Inspect current files and actual builds/tests before assuming all details were completed.**

### Recent confirmed runtime status

- Starting NestJS initially failed with **`Missing required environment variable: DATABASE_URL`**.
- The user corrected the API `.env` loading, using `ConfigModule.forRoot` with an appropriate `envFilePath` for the PNPM script working directory. The user confirmed the missing-variable error **disappeared**.
- NestJS ran on port **4000** and `curl -i http://localhost:4000/health/database` returned **`HTTP/1.1 200 OK`**.
- The user supplied **only the HTTP response headers**, not the JSON body, and the assistant repeatedly requested the body. Therefore a 200 response is reported, but **the exact JSON payload and evidence that the endpoint executes `SELECT 1` were not shown in the conversation**. Inspect `health` endpoint implementation or obtain the body before asserting complete DB end-to-end verification.

Useful commands from the monorepo root:

```bash
pnpm dev:api                              # If root script exists
pnpm --filter ./apps/api start:dev       # Direct NestJS dev start
pnpm --dir packages/db exec tsc --noEmit --pretty false
curl -sS http://localhost:4000/health/database; echo
```

If needed, build `@project/db` before building/running an API that consumes its compiled exports. Inspect current scripts rather than assuming their precise names.

## 7. Planned authentication and authorization

- **Authentication:** Better Auth, centrally integrated with the NestJS backend; not yet implemented/verified.
- **Authorization:** start with RBAC: roles, permissions, user-role membership and role-permission membership, or use Better Auth's built-in mechanisms if they fit without duplicating tables.
- Suggested authorization schema: `roles`, `permissions`, `user_roles`, `role_permissions` linked to authenticated users.
- Permission identifiers such as `students.read`, `students.update`, `attendance.create`, `exams.update`, and `hr.read`.
- NestJS guards/decorators enforce permissions server-side; UI navigation hiding alone is not security.
- Later use ownership rules/possibly CASL for situations such as “student may only see their own record.”

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
- Centralized database migrations should live with `packages/db`; avoid connecting directly to PostgreSQL from browser micro-frontends.

## 10. Immediate next actions

1. **Verify database health-check response body and implementation:** run `curl -sS http://localhost:4000/health/database; echo` while NestJS and PostgreSQL are up. Confirm `SELECT 1` is actually performed through the shared pool, and verify expected HTTP 503 behavior on disconnection when safe to test.
2. **Inspect latest repo state** before proceeding: check whether Codex completed ESM build exports, NestJS `ConfigModule`, registered `DatabaseModule`, singleton pool, shutdown hook and tests; validate builds.
3. **Only then design foundational Drizzle schemas**, starting with domain boundaries and shared identities, followed by Student Affairs as a possible first substantive module. Coordinate assets/locations between Facilities, Inventory and Maintenance.
4. Design shared contracts and API conventions, and decide when to implement Better Auth/RBAC.
5. Before production, plan independent remote deployment, environment-specific federation manifests/URLs, cross-origin constraints, release compatibility, operational monitoring, backups and security.

## 11. Suggested instruction to a new assistant

> I am developing the IT Faculty Management System documented in this file. Treat this as project context, but inspect the current repository before assuming any proposed code exists. My architecture is a PNPM monorepo with **one NestJS API**, **React/Vite Module Federation shell plus ten independently deployable remotes**, **PostgreSQL/Drizzle** in `@project/db`, and planned **Better Auth/RBAC**. I work in **WebStorm with Codex CLI** and want **step-by-step guidance** with copyable commands and approval before major edits. Do not suggest Next.js. Continue from the latest verified state, rather than recreating work already done.
