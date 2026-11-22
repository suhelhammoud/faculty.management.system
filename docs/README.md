# Faculty Management System documentation

The pnpm workspace contains one React and Vite frontend at `apps/web` and one
NestJS API at `apps/api`. The overview describes the implemented architecture.
Module specifications also record proposed requirements and open decisions.

## Architecture and setup

- [Project overview](project-overview.md) covers the workspace, frontend routes, and deployment.
- [Pilot release and recovery](pilot-runbook.md) covers coordinated releases and the PostgreSQL restore rehearsal.
- [Local setup](../README.md#configure-migrate-and-seed) covers configuration, migrations, and demo data.
- [Auth API setup](auth-api-setup.md) covers sessions, trusted origins, and administrator bootstrap.
- [Shared authorization](modules/authorization/README.md) describes roles, permissions, and record access.
- [Development handover](IT_Faculty_Project_Context.md) records project context and collaboration preferences.

## Module specifications

Each module has a specification in `docs/modules/`. Implemented modules also link to their frontend and API guides.

- [Attendance](modules/attendance/README.md)
- [Maintenance](modules/maintenance/README.md)
- [Supervision](modules/supervision/README.md)
- [Meetings](modules/meetings/README.md)
- [HR](modules/hr/README.md)
- [Exams](modules/exams/README.md)
- [Correspondence](modules/correspondence/README.md)
- [Inventory](modules/inventory/README.md)
- [Facilities](modules/facilities/README.md)
- [Student Affairs](modules/student-affairs/README.md)
- [Workflow engine and queues](modules/workflows/IMPLEMENTATION-PLAN.md)
- [Workflow designer, draft sharing, and access setup](modules/workflows/designer.md)

## Planning notes

- [Identity and access](identity-and-access.md) records requirements and open questions for account provisioning and recovery.
- [Authentication and authorization plan](authentication-and-authorization-plan.md) records the original design.
