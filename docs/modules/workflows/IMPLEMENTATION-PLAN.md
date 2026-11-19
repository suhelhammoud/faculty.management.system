# Shared Workflow Implementation Plan

## Purpose and initial scope

Build a reusable Workflows module inside the shared NestJS API. Inventory, Student Affairs, Exams, HR, and future modules can use it to route work through a sequence of people. Inventory removal is the first worked example. The other examples show how the same contract applies to different records and access rules.

Start with versioned TypeScript definitions, one active task at a time, permission-based queues, a common task inbox, and a read-only monitor. Support assignment to a specific person when a process requires it. Add parallel approvals, timers, notifications, claiming, reassignment, and a workflow editor when a confirmed process needs them.

## NestJS module structure

Create `WorkflowsModule` in `apps/api/src/modules/workflows` and include it in `AppModule`. It owns the shared controller, workflow service, and definition registry. It imports `AuthModule` for the shared authorization service and uses the existing database provider. Put the shared tables and migrations in `packages/db`.

Export the workflow service and registration interface. Inventory, Exams, Student Affairs, and other participating modules import `WorkflowsModule` and register their definitions and handlers during initialization. Keep their definitions and handlers in their own module directories. Validate registrations after the feature modules have registered and before serving requests. Dependencies point from participating modules to WorkflowsModule, so adding a workflow requires no dependency on its owning module inside the engine.

## Ownership and data model

- **Workflows** manages instances, tasks, transitions, and append-only event history. It resolves the registered definition for each instance and enforces task eligibility and the transition rules.
- **Business modules** register their definitions and matching handlers. Each module owns its records, request revisions, evidence, record-level access rules, action validation, and business updates. It starts a workflow from its request or business record and defines what each action means for that record.

Use three shared PostgreSQL tables:

| Table                | Contents                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workflow_instances` | ID, definition key and version, starter user, lifecycle status, current step, start and completion timestamps, and a stable subject reference with module, record type, and record ID. |
| `workflow_tasks`     | ID, instance ID, step key, optional assigned user, pending/completed/cancelled status, and open and completion timestamps. Each visit to a step gets its own task ID.                  |
| `workflow_events`    | ID, instance ID, optional task ID, action, actor, timestamp, and workflow comment where appropriate. Corrections append a new event.                                                   |

Enforce at most one pending task per instance with a PostgreSQL partial unique index. Keep action history in events and resolve step eligibility from the pinned definition. Keep marks, student records, attachments, and per-item decisions in the owning module's typed tables. Workflow history can reference the domain revision or decision that an action used.

## TypeScript definitions

Each definition declares a namespaced key, version, initial step, and steps with instructions, eligibility, and action transitions. A transition identifies a next step or a terminal workflow status. The Inventory definition uses typed step permissions from the shared catalog. [Inventory definition](../../../apps/api/src/modules/inventory/inventory-removal.definition.ts)

```ts
import { PERMISSION, type PermissionKey } from '@project/authorization';

type Transition<Step extends string> =
  { next: Step } | { finish: 'completed' | 'rejected' | 'cancelled' };

type WorkflowDefinition<Step extends string> = {
  key: `${string}.${string}`;
  version: number;
  title: string;
  description: string;
  initialStep: Step;
  steps: Record<
    Step,
    {
      title: string;
      instructions: string;
      eligible: { permission: PermissionKey } | { requester: true };
      actions: Record<string, Transition<Step>>;
    }
  >;
};

type RemovalStep = 'review' | 'revise' | 'committee-decision';

export const inventoryRemovalV1 = {
  key: 'inventory.removal',
  version: 1,
  title: 'Asset removal review',
  description: 'Reviews proposed assets and records the removal decision.',
  initialStep: 'review',
  steps: {
    review: {
      title: 'Review request',
      instructions: 'Review the proposed assets and the reasons for removal.',
      eligible: { permission: PERMISSION.inventory.reviewRemoval },
      actions: {
        forward: { next: 'committee-decision' },
        return: { next: 'revise' },
        reject: { finish: 'rejected' },
      },
    },
    revise: {
      title: 'Revise request',
      instructions: 'Address the review comments and resubmit the proposal.',
      eligible: { requester: true },
      actions: {
        resubmit: { next: 'review' },
      },
    },
    'committee-decision': {
      title: 'Record committee decision',
      instructions: 'Record an outcome and reason for each proposed asset.',
      eligible: { permission: PERMISSION.inventory.decideRemoval },
      actions: {
        'record-decision': { finish: 'completed' },
        return: { next: 'revise' },
      },
    },
  },
} satisfies WorkflowDefinition<RemovalStep>;
```

Validate the registry at startup. Reject duplicate definition key/version pairs, missing or unknown step references, and unregistered permission keys. Use the designated active version for new starts. Keep the original definition and matching handlers available while instances using that version are active.

The owning module registers handlers for record access and action processing alongside the definition. For example, the Inventory handler requires a reason on return, validates each item decision, and applies approved asset changes. The engine uses the same registration contract for every module.

## Authorization

Use the typed `PERMISSION` constants and `PermissionKey` from `@project/authorization`. The package defines permission keys and bootstrap role templates. PostgreSQL holds live roles, grants, and user assignments. Grant step permissions through the existing Administration API and synchronize the permission catalog during deployment. Existing roles need an explicit grant for new keys. [Shared authorization guide](../authorization/README.md)

The workflow service resolves the actor from the signed-in session and evaluates current authorization for the subject. The module applies record-level rules such as exam session scope or access to a particular student request. A requester step uses the requester identified by the module, which can differ from the student or employee the request concerns. When the process requires a named assignee, require that assignment as well as step eligibility. Check specific role membership in addition to the step permission when institutional policy requires it, such as formal committee membership. Modules can also enforce separation of duties.

Apply module record scope and the relevant visibility rules to the inbox, direct links, instance history, and monitor. Viewing a request or its history and acting on its current task have separate authorization rules. Apply history and comment visibility before returning those fields. Recheck current step eligibility and record access on action submission even when the task appeared in the user's inbox.

## API and transaction behavior

Keep the `/workflow/` segment in workflow URLs. Use these shared endpoints:

- `GET /api/workflow/tasks` lists pending tasks the signed-in user can act on.
- `GET /api/workflow/tasks/:taskId` loads a task by ID for the review page and exposes the actions currently available to the caller.
- `GET /api/workflow/instances/:instanceId` returns the current instance and the history the caller may view.
- `POST /api/workflow/tasks/:taskId/actions` is the single endpoint for submitting a task action. It accepts an action key, an optional comment, and any input validated by the owning module.

Module endpoints start workflows and serve domain details. For example, Inventory creates a proposal and starts its workflow via `POST /api/inventory/workflow/removal-requests`. The proposal and its item details are available via `GET /api/inventory/workflow/removal-requests/:requestId`.

Create the domain request, workflow instance, initial task, and start event in one PostgreSQL transaction. On each action, serialize work for the instance by locking its row before its task row. Recheck the active task, action, and actor once inside the transaction. Pass the same transaction to the module handler, then persist the task outcome, event, and next task or terminal status together with any domain changes.

Accept an idempotency key for starts and action submissions. Scope it to the authenticated actor, operation, and target when present. Persist a successful result with the write and return it for an identical retry subject to current read authorization. Check for a replay before applying the pending-task requirement. Return a conflict if a key is reused with different input or a competing submission uses a different key against a completed task.

The module records the version of the data being reviewed and checks for relevant changes before applying a decision. On a stale-record conflict, roll back the submission and leave its task pending so the actor can use the recovery action defined for that step. A return opens a new revision task and preserves the prior submission and history. Resubmission sends a new revision through review.

### HTTP response contracts

The API, shell, and Inventory use type imports from `@project/contracts/workflow`.
The [contract declarations](../../../packages/contracts/workflow.d.ts) describe JSON
responses and have no runtime dependencies.

| Response                            | Shared type                         |
| ----------------------------------- | ----------------------------------- |
| Task inbox and task detail          | `WorkflowTask[]` and `WorkflowTask` |
| Instance monitor                    | `WorkflowInstance[]`                |
| Instance detail and visible history | `WorkflowInstanceDetail`            |
| Start or submit an action           | `WorkflowActionResult`              |

The API explicitly maps records to these types and serializes timestamps as ISO
strings. Instances include the pinned definition key and version. Task status
and instance status have separate types. Nullable values such as a task's
assignee, a completed instance's current task, and an event's task ID or hidden
comment are represented as `null`.

Step and action keys remain strings so different modules can use their own keys.
The UI uses the task's `actions` list to display the actions available to the
current user. The API still applies record access and action authorization.
Engine definitions, registration hooks, and Drizzle records stay in the backend.
Inventory owns its removal proposal and committee decision types.

## Inbox and monitor

Use one shared inbox, with module review pages for domain details and forms. Support refresh and deep links by fetching current data using stable IDs in paths such as `/workflow/tasks/:taskId` and `/inventory/workflow/removal-requests/:requestId`. Show the workflow title and purpose, step instructions, actions the user can take, and the history they may view.

Inventory implements its task, proposal, history, and monitor screens under
`/inventory/workflow/`. These screens work both standalone and in the shell.
The shell retains the shared inbox and monitor. Its Inventory removal task and
history links open the corresponding localized Inventory screens.
[Inventory routing](inventory-removal.md#inbox-and-pages)

The read-only monitor shows the current step, start date, last activity, and chronological history. Authorized users can filter by lifecycle status and step.

## Worked examples

### Inventory removal

An Inventory requester submits proposed assets and removal reasons. The implemented workflow uses these transitions.

| Step               | Eligible actor                                                    | Action               | Result                                                                                                          |
| ------------------ | ----------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Review             | User with the removal-review permission and access to the request | Forward              | Open a committee decision task.                                                                                 |
| Review             | Same reviewer eligibility                                         | Return with a reason | Open a revision task for the requester.                                                                         |
| Review             | Same reviewer eligibility                                         | Reject               | End the request as rejected and retain the proposal and decision history.                                       |
| Revise             | Requester with access to the request                              | Resubmit             | Save a new proposal revision and open a new review task.                                                        |
| Committee decision | User authorized to record the committee decision for the request  | Record decision      | Record the dated, named committee decision and an outcome and reason for each item, then complete the workflow. |
| Committee decision | Same committee decision eligibility                               | Return with a reason | Open a revision task for the requester.                                                                         |

The committee action accepts approved-for-waste, rejected, and deferred item outcomes in the same request. Before applying approved results, Inventory locks the affected assets and verifies each approved asset’s status, revision, and custody against the reviewed proposal. Approved items become decommissioned and their active custody ends. Rejected and deferred items retain their status and custody. A deferred item is a recorded committee outcome. The workflow completes when the committee decision is recorded. Record any later physical disposal as a separate Inventory transaction. One authorized recorder submits each committee decision. [Inventory implementation specification](../inventory/IMPLEMENTATION-SPEC.md#initial-transaction-workflows)

### Exams results approval

An exam result batch moves from verification within the authorized course or session scope to director approval. A return opens a revision task and the revised batch goes through verification again. Exams owns the reviewed mark version, applies any separation-of-duties rule, and records approval before publication. Publishing or exporting results is a separately authorized Exams action. The exact roles, approval scope, and lock point need institutional confirmation. [Exams module specification](../exams/README.md#core-workflow)

### Student Affairs certificate request

A staff member could open a certificate request on behalf of a student. The request records the student, the staff actor who submitted it, and the person permitted to revise it. Student Affairs controls access to the request, supporting records, and any student-facing history. Its workflow can route a return to the designated requester and completion to the module's certificate issuance process. Request eligibility, visibility, and issuance rules need institutional confirmation. [Student Affairs module specification](../student-affairs/README.md#open-decisions)

## Acceptance checks

- A mixed Inventory decision writes one outcome per item. Only approved-for-waste items change status and custody.
- A returned proposal retains its original revision, review comments, and actors. Resubmission opens a new review task on the new revision.
- Two reviewers submitting the same task concurrently cause one transition. Retrying the winning request with the same idempotency key returns the existing result with no additional task, event, or domain change.
- An asset handover during review produces a conflict on a stale decision. The workflow and asset writes roll back together, and the reviewer can still return the proposal.
- An out-of-scope user cannot discover the task in the inbox, open its history by direct link, or act on it. A user who loses the step permission after opening the task cannot submit a decision.
- An instance started under an older definition version can still advance using its matching handlers after a new version becomes active.

## Run Inventory removal

Apply the database migration and synchronize the shared permission catalog before starting the updated API.

```sh
pnpm --filter @project/db migrate
pnpm --filter @project/db seed:permissions
```

Use shared Administration to grant the permissions appropriate to each existing role.

| Permission                  | Use                                                                             |
| --------------------------- | ------------------------------------------------------------------------------- |
| `inventory:manage-assets`   | Register assets and manage their HR employee custody through the Inventory API. |
| `inventory:request-removal` | Create a removal proposal.                                                      |
| `inventory:removal-review`  | Review a proposal and forward, return, or reject it.                            |
| `inventory:removal-decide`  | Record the committee's decision or return a proposal for revision.              |
| `workflow:monitor`          | Open the shared read-only monitor for records within the user's access scope.   |

Set `VITE_API_URL` for Inventory and the shell when using a custom API origin.
Include both frontend origins in the API's `TRUSTED_ORIGINS`. Start from
**Propose asset removal** in Inventory or open the shared inbox with **Workflows**
in the shell. The [local Inventory guide](../../../apps/inventory/README.md) lists
the seeded accounts and walkthrough. Exams and Student Affairs can register
their own processes when their policies are confirmed.
