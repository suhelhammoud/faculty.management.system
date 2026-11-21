# Inventory removal workflow

This document describes the asset removal workflow implemented by the Inventory module. It covers proposal submission, review and revision, and recording the committee decision.

## Inbox and pages

Start from **Propose asset removal** in Inventory. The shared inbox at
`/workflow/tasks` links to an Inventory removal task through the shared task
route, which forwards the task to `/inventory/workflow/tasks/:taskId`.

| Task step          | Who sees it in their inbox                     | Actions on the Inventory page                         |
| ------------------ | ---------------------------------------------- | ----------------------------------------------------- |
| Review             | Eligible users with `inventory:removal-review` | Forward to committee, return with a reason, or reject |
| Revise             | Original requester                             | Edit and resubmit the proposal                        |
| Committee decision | Eligible users with `inventory:removal-decide` | Record each item's outcome or return with a reason    |

A successful action opens `/inventory/workflow/instances/:instanceId` for the
person who submitted it. Any next task appears in the next eligible user's
inbox. The same task page loads the task by ID and displays the actions returned
by the API. [Inventory routes](../inventory/IMPLEMENTATION-SPEC.md#removal-pages-and-task-routing)

## Submit and review

The requester submits proposed assets and reasons. The API checks the request-removal permission, saves the proposal and starts a workflow in one transaction. A reviewer can forward the proposal to the committee, return it for revision with a reason, or reject it.

```mermaid
sequenceDiagram
    actor Requester
    participant API as Inventory API
    participant Auth as Authorization
    participant DB as Database
    participant WF as Workflows service

    Requester->>API: POST removal-requests (proposal)
    API->>WF: start(actor, proposal, idempotency key)
    WF->>DB: Begin transaction
    WF->>Auth: Check request-removal permission
    Auth-->>WF: Allowed
    WF->>DB: Create removal request
    WF->>DB: Lock assets, verify active status, and capture revisions and custody
    WF->>DB: Save proposal items
    WF->>DB: Create workflow instance, review task, and start event
    WF->>DB: Commit
    WF-->>Requester: Request and workflow IDs

    actor Reviewer
    Reviewer->>WF: Submit review action
    WF->>DB: Lock workflow instance and task
    WF->>Auth: Recheck reviewer eligibility and request access
    Auth-->>WF: Allowed
    WF->>API: Apply action and validate return reason if needed
    alt Forward
        WF->>DB: Complete review task and create committee decision task
    else Return
        WF->>DB: Complete review task and create requester revision task
    else Reject
        WF->>DB: Complete task and mark workflow rejected
    end
    WF->>DB: Save event and commit
    WF-->>Reviewer: Updated workflow
```

## Return and resubmit

When a reviewer or committee decision recorder returns the request, the requester can submit a revised proposal. Inventory saves the new items as a new revision and routes the workflow back to review.

```mermaid
sequenceDiagram
    actor Requester
    participant WF as Workflows service
    participant API as Inventory API
    participant DB as Database

    Note over Requester,DB: A reviewer has returned the request with a reason
    Requester->>WF: Submit resubmit action with revised proposal
    WF->>DB: Lock workflow instance and requester revision task
    WF->>WF: Check requester eligibility
    WF->>API: Validate proposal and apply resubmission
    API->>DB: Lock assets, verify active status, and capture new revisions and custody
    API->>DB: Save items under next proposal revision
    API->>DB: Update request current revision
    WF->>DB: Complete revision task and create review task and action event
    WF->>DB: Commit
    WF-->>Requester: Updated workflow
```

## Record committee decision

An authorized recorder submits exactly one outcome for every asset in the current proposal revision. Approved-for-waste assets are checked against the status, revision, and custody captured in the proposal. A stale asset causes the transaction to roll back, leaving the workflow task pending so the request can be returned for revision.

```mermaid
sequenceDiagram
    actor Recorder as Decision recorder
    participant WF as Workflows service
    participant API as Inventory API
    participant DB as Database

    Recorder->>WF: Submit record-decision action
    WF->>DB: Lock workflow instance and committee task
    WF->>WF: Check decision permission and request access
    WF->>API: Validate one decision per proposed asset
    API->>DB: Load current proposal revision
    API->>DB: Lock approved assets and compare status, revision, and custody
    alt Approved asset changed during review
        API-->>WF: Report conflict because an asset changed
        WF->>DB: Roll back transaction and leave task pending
        WF-->>Recorder: Report conflict and suggest returning the request for revision
    else Proposal is current
        loop Each approved-for-waste asset
            API->>DB: Decommission asset and end active custody
        end
        API->>DB: Save dated committee decision, per-item outcomes, and ledger entry
        WF->>DB: Complete task, mark workflow completed, and append event
        WF->>DB: Commit
        WF-->>Recorder: Completed workflow
    end
```

Record physical disposal as a separate Inventory transaction after committee approval.
