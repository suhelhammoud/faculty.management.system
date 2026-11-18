# Shared Workflow Implementation Plan

## Purpose

Provide a reusable workflow capability for processes that pass through an ordered sequence of users with different roles. Examples include inventory removal decisions, HR requests, and other future module processes.

The workflow capability owns step progression, task assignment, authorization checks, and action history. Each business module continues to own its request data and applies its own business changes when a workflow reaches a successful outcome.

## Recommended initial scope

Build a lightweight workflow service inside the existing NestJS API. Start with sequential steps, role- or permission-based task queues, and a small set of common actions such as approve, reject, return for changes, and defer. Record the user who performs each action. Allow a specific user assignment only when a process requires it; defer task claiming and reassignment until there is a concrete need. Add branching or parallel approvals only when a defined process requires them.

Start workflows from their related business record or module request page. Define workflow templates in versioned TypeScript code initially. Give every workflow a clear name and description, and every step a title and instructions. Consider an administrator-facing workflow editor later if process owners need to change sequences without a software release. Do not begin with a general-purpose BPMN editor or allow arbitrary executable workflow rules to be stored in the database.

## Concepts

- **Workflow definition/template:** A versioned description of the workflow’s name and purpose, ordered step titles and instructions, eligible roles or permissions, allowed actions, and transitions.
- **Workflow instance:** One running process, linked to a business request or record. It records the definition version it started with.
- **Task:** Work awaiting action at a particular step. A role-based task may be visible to eligible users; the system records which user actually completes it.
- **Workflow event:** An immutable history entry recording an action, actor, date, comment, and relevant decision data.
- **Domain request data:** Module-owned proposed information being reviewed. It is stored separately from the current official business records.

## Data model

Create shared tables once; new workflow types should normally add definitions and instances, not a new set of workflow-engine tables.

### Shared workflow tables

1. **`workflow_instances`**
   - ID.
   - Definition key and version.
   - Current step key.
   - Lifecycle status, such as running, completed, rejected, or cancelled.
   - Starter user and start/completion timestamps.
   - A stable subject reference for linking the process to a module record.

2. **`workflow_tasks`**
   - ID and workflow instance ID.
   - Step key and required role or permission.
   - Optional specifically assigned user when required by the process; otherwise, the task is available to the eligible role/permission group.
   - Pending/completed/cancelled status.
   - Acting user, action, opened/completed timestamps, and comments as appropriate.

3. **`workflow_events`**
   - ID, workflow instance ID, and optional task ID.
   - Event type/action, actor user, timestamp, comment, and structured decision data.
   - Append-only history. Corrections should create additional events rather than rewriting past events.

### Module-owned request data

Use existing module records when they already represent the request. Add domain-specific request tables only when a workflow needs proposed data that is not already represented. For example, Inventory can store removal requests and their item/reason lines, linked to a workflow instance. HR can link an existing leave request to a workflow instance.

Use typed module tables for important searchable business data. Avoid placing an entire request in an untyped JSON payload. Small step-specific answers may be stored as structured JSON when appropriate, while validation remains in application code.

## Workflow definition shape

Definitions are versioned in code and identify the workflow key, version, user-facing name and description, ordered step keys, step titles and instructions, eligibility requirements, allowed actions, validation rules, and transitions. Example only; actual roles and decisions must be confirmed for each process:

```ts
const inventoryRemovalV1 = {
  key: 'inventory.removal',
  version: 1,
  title: 'Asset removal review',
  description: 'Reviews malfunctioning assets and records the removal decision.',
  steps: [
    {
      key: 'review',
      title: 'Review request',
      instructions:
        'Review the asset details and reported malfunction. Approve, return, or reject the request.',
      permission: 'inventory:removal-review',
      actions: ['approve', 'return', 'reject'],
    },
    {
      key: 'committee-decision',
      title: 'Committee decision',
      instructions: 'Record an outcome and reason for each proposed asset.',
      permission: 'inventory:removal-decide',
      actions: ['approve-waste', 'defer', 'reject'],
    },
  ],
};
```

The running instance stores the definition key and version, so in-progress workflows continue under the version they started with when a later definition is introduced. New instances use the current active version. Keep older definitions available while instances using them remain active.

## Backend architecture

Implement a shared Workflows module/service under the API. Follow existing NestJS, Drizzle, validation, authentication, and permission patterns.

The shared service should provide operations conceptually similar to:

```ts
start(tx, { definitionKey, subject, startedBy });
advance(tx, { taskId, actorId, action, comment, input });
```

`advance` should validate that:

- The workflow instance is active and the task is its current task.
- The action is allowed by the current definition step.
- The signed-in user has the required permission and is eligible to act.
- The submitted action data is valid for that step.

Never trust a role or permission asserted by the frontend. Resolve authorization from the signed-in user through the shared authorization system.

For sequential workflows, create the next task only after the current task completes. A role- or permission-based task appears in the inbox of eligible users, and an eligible user can complete it directly. Record the user who actually acts. Use a specific user assignment only if the process requires it. Add claiming or reassignment later if users need to reserve tasks or managers need to redirect them.

## Transaction safety and domain changes

Keep workflow state in PostgreSQL; do not rely on in-memory process state or frontend state for active workflow data.

Advance an instance under a database transaction and lock the relevant instance/task rows so two users cannot complete the same step concurrently. Validate current status and allowed action again inside that transaction.

The workflow service determines whether the process advanced or completed. The owning module applies its business changes. On successful terminal completion, perform the final workflow update and domain updates atomically. For example, an approved Inventory removal should update asset status, end active custody, create the final Inventory transaction, and complete the workflow within one database transaction. If any operation fails, roll back the entire transaction.

While the process is pending, store proposed changes in module-owned request tables. Do not update the official asset/employee records until the workflow succeeds. Record the version or `updatedAt` value of records when proposed; before applying changes, detect if the underlying record changed during review and surface a conflict instead of overwriting newer data.

Rejected or deferred requests retain their workflow and request history. Rejection must not apply pending changes to official records. A return-for-changes action should route the request to the appropriate prior actor/step according to the definition.

## API shape and URL convention

All workflow-related API paths must include the `/workflow/` segment. Use a consistent shared prefix such as:

- `GET /api/workflow/tasks` — tasks available to or assigned to the signed-in user.
- `GET /api/workflow/instances/:instanceId` — current workflow state and history.
- `POST /api/workflow/tasks/:taskId/actions` — submit an action for a task.

Module APIs own workflow initiation and domain-specific request details. For example:

- `POST /api/inventory/workflow/removal-requests` — create a removal request and start its workflow.
- `GET /api/inventory/workflow/removal-requests/:requestId` — retrieve the request and its item details.
- `POST /api/inventory/workflow/removal-requests/:requestId/actions` — record a domain-specific action and apply final Inventory changes when appropriate.

Choose either shared task action handling or module-specific action endpoints consistently. If the terminal action changes domain records, ensure workflow progression and domain changes use the same database transaction.

## Frontend and routes

Provide a shared workflow task inbox, either in the shell or a dedicated workflow app. Integrate module-specific screens incrementally; modules that do not start or handle workflows need not be changed.

All frontend workflow routes must include the `/workflow/` segment. Examples:

- `/workflow/tasks` — shared task inbox.
- `/workflow/tasks/:taskId` — task review page.
- `/inventory/workflow/removal-requests/:requestId` — Inventory-specific request details.
- `/hr/workflow/requests/:requestId` — an HR-specific review page when needed.

Pass stable IDs in URLs, then fetch workflow and business data from the API. Do not rely on router state as the only copy of important data; deep links and refreshes must work. The shared inbox can display common task details and link to the module page for domain-specific evidence or forms.

Display the workflow name and purpose, the current step title and instructions, the related business record, available actions, and prior actions/comments. Keep a basic workflow monitor for authorized staff with filters for status and current step, plus a detail view showing start date, last activity, and chronological task/event history. This provides visibility into pending or stalled instances without requiring a visual workflow designer or advanced administration controls.

## Example: Inventory removal workflow

1. Inventory staff create a removal request with one or more malfunctioning assets and reasons.
2. The API saves the proposed request data and starts a workflow instance; live asset custody/status remain unchanged.
3. The authorized reviewer completes the current task. The service records the actor, action, date, and comment, then advances or returns/rejects the request.
4. The committee records an outcome per item, since one request may contain different item decisions.
5. If the workflow reaches its successful outcome, Inventory applies approved results atomically: mark approved items decommissioned/waste, end active custody, create dated Inventory transaction records, and complete the workflow.
6. Rejected or deferred items retain their existing state and custody. Their proposal and decision history remain available.

Actual role names, decision values, review sequence, and whether one or all committee members must act are business decisions to confirm before implementation.

## Initial implementation boundaries

- Support sequential workflows first.
- Keep definitions versioned in code initially.
- Start each workflow from its related business record or module request page.
- Include a descriptive workflow name and purpose, plus a title and instructions for each step.
- Use role/permission-based task queues and record the acting user; defer claim and reassignment features.
- Use shared workflow tables for runtime state and history.
- Keep domain request data in the owning module.
- Enforce permissions and transitions in the backend.
- Build one shared task inbox and add module-specific review pages only where needed.
- Include a basic read-only monitor and chronological history for authorized staff.
- Defer parallel approvals, time-based escalation, dynamic workflow editing, and a visual workflow designer until requirements justify them.
- Defer email notifications, task claiming, task reassignment, and step-skipping/recovery controls until a workflow requires them.
