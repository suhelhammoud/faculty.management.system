import { DesignerLink } from './DesignerLink';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import type {
  WorkflowActionResult,
  WorkflowInstance,
  WorkflowInstanceDetail,
  WorkflowPage,
  WorkflowTask as WorkflowTaskResponse,
} from '@project/contracts/workflow';
import { workflowApi } from './api';
import { QueuePagination } from './QueuePagination';
import './workflows.css';

const removalPath = 'inventory/workflow/removal-requests';
const actionLabels: Record<string, string> = {
  started: 'Submitted',
  forward: 'Forward to committee',
  return: 'Return for revision',
  reject: 'Reject request',
  resubmit: 'Resubmit proposal',
  'record-decision': 'Record decision',
};
const label = (value: string) => actionLabels[value] ?? value.replaceAll('-', ' ');
const dateTime = (value: string) => new Date(value).toLocaleString();
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Request failed';

function useResource<T>(path: string | undefined) {
  const [state, setState] = useState<{ path: string; data?: T; error?: string }>();
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    void workflowApi<T>(path, undefined, controller.signal).then(
      (data) => setState({ path, data }),
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ path, error: errorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [path]);
  return state?.path === path ? state : undefined;
}

function Resource<T>({
  state,
  children,
}: {
  state: { data?: T; error?: string } | undefined;
  children: (value: T) => ReactNode;
}) {
  if (state?.error) return <p role="alert">{state.error}</p>;
  if (state?.data === undefined) return <p role="status">Loading…</p>;
  return children(state.data);
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="workflow-page">
      <h1>{title}</h1>
      <nav className="module-navigation" aria-label="Workflow pages">
        <NavLink to="/workflow/tasks">Task inbox</NavLink>
        <NavLink to="/workflow/monitor">Monitor</NavLink>
        <DesignerLink />
        <NavLink to={`/${removalPath}/new`}>Propose asset removal</NavLink>
      </nav>
      {children}
    </section>
  );
}

export function WorkflowInbox() {
  const [params] = useSearchParams();
  const cursor = params.get('cursor');
  const state = useResource<WorkflowPage<WorkflowTaskResponse>>(
    cursor ? `workflow/tasks?cursor=${encodeURIComponent(cursor)}` : 'workflow/tasks',
  );
  return (
    <Frame title="Task inbox">
      <Resource state={state}>
        {({ records: tasks, nextCursor }) => (
          <>
            {tasks.length ? (
              <ul>
                {tasks.map((task) => (
                  <li key={task.id}>
                    <Link to={`/workflow/tasks/${task.id}`}>{task.title}</Link>
                    <p>{task.instance.title}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No tasks are available.</p>
            )}
            <QueuePagination nextCursor={nextCursor} />
          </>
        )}
      </Resource>
    </Frame>
  );
}

export function WorkflowMonitor() {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const state = useResource<WorkflowPage<WorkflowInstance>>(
    `workflow/instances${query ? `?${query}` : ''}`,
  );
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const selected = new URLSearchParams();
    for (const field of ['status', 'step']) {
      const value = String(fields.get(field) ?? '').trim();
      if (value) selected.set(field, value);
    }
    setParams(selected);
  }
  return (
    <Frame title="Workflow monitor">
      <form className="workflow-filters" key={query} onSubmit={filter}>
        <label>
          Status{' '}
          <select name="status" defaultValue={params.get('status') ?? ''}>
            <option value="">All statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label>
          Step key <input name="step" defaultValue={params.get('step') ?? ''} />
        </label>
        <button type="submit">Filter</button>
      </form>
      <Resource state={state}>
        {({ records: instances, nextCursor }) => (
          <>
            {instances.length ? (
              <ul>
                {instances.map((instance) => (
                  <li key={instance.id}>
                    <Link to={`/workflow/instances/${instance.id}`}>{instance.title}</Link>
                    <p>
                      {instance.status}
                      {instance.currentStep && ` · ${label(instance.currentStep)}`}
                    </p>
                    <p>
                      Started {dateTime(instance.startedAt)} · Last activity{' '}
                      {dateTime(instance.lastActivityAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No workflows match.</p>
            )}
            <QueuePagination nextCursor={nextCursor} />
          </>
        )}
      </Resource>
    </Frame>
  );
}

export function WorkflowHistory() {
  const { id } = useParams();
  const state = useResource<WorkflowInstanceDetail>(id && `workflow/instances/${id}`);
  return (
    <Frame title="Workflow history">
      <Resource state={state}>
        {(instance) =>
          isRemoval(instance) ? (
            <Navigate replace to={`/inventory/workflow/instances/${instance.id}`} />
          ) : (
            <>
              <h3>{instance.title}</h3>
              <p>{instance.description}</p>
              <p>
                {instance.status}
                {instance.currentStep && ` · ${label(instance.currentStep)}`}
              </p>
              <p>
                Started {dateTime(instance.startedAt)} · Last activity{' '}
                {dateTime(instance.lastActivityAt)}
              </p>
              {instance.currentTaskId && (
                <Link to={`/workflow/tasks/${instance.currentTaskId}`}>View current task</Link>
              )}
              <ol>
                {instance.history.map((event) => (
                  <li key={event.id}>
                    <strong>{label(event.action)}</strong> · {dateTime(event.occurredAt)} ·{' '}
                    {event.actorId}
                    {event.comment && <p>{event.comment}</p>}
                  </li>
                ))}
              </ol>
            </>
          )
        }
      </Resource>
    </Frame>
  );
}

function isRemoval(instance: WorkflowInstance) {
  return instance.subjectModule === 'inventory' && instance.subjectType === 'removal-request';
}

function useSubmit(path: string) {
  const navigate = useNavigate();
  const retry = useRef<{ json: string; key: string } | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(body: unknown) {
    setPending(true);
    setError('');
    const json = JSON.stringify(body);
    if (retry.current?.json !== json) retry.current = { json, key: crypto.randomUUID() };
    try {
      const result = await workflowApi<WorkflowActionResult>(path, {
        body,
        key: retry.current.key,
      });
      void navigate(`/workflow/instances/${result.instanceId}`);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  return { submit, pending, error };
}

export function WorkflowTask() {
  const { id } = useParams();
  const state = useResource<WorkflowTaskResponse>(id && `workflow/tasks/${id}`);
  return (
    <Frame title="Review task">
      <Resource state={state}>
        {(task) =>
          isRemoval(task.instance) ? (
            <Navigate replace to={`/inventory/workflow/tasks/${task.id}`} />
          ) : (
            <TaskBody key={task.id} task={task} />
          )
        }
      </Resource>
    </Frame>
  );
}

function TaskBody({ task }: { task: WorkflowTaskResponse }) {
  return (
    <>
      <h3>{task.title}</h3>
      <p>
        {task.instance.title} · {task.status}
      </p>
      <p>{task.instructions}</p>
      <Link to={`/workflow/instances/${task.instance.id}`}>View workflow history</Link>
      <TaskActions task={task} />
    </>
  );
}

function TaskActions({ task }: { task: WorkflowTaskResponse }) {
  const [action, setAction] = useState(task.actions[0] ?? '');
  const [comment, setComment] = useState('');
  const { submit, pending, error } = useSubmit(`workflow/tasks/${task.id}/actions`);
  if (!task.actions.length) return <p>No actions are available.</p>;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit({ action, comment: comment || undefined });
      }}
    >
      <label>
        Action
        <select value={action} onChange={(event) => setAction(event.target.value)}>
          {task.actions.map((key) => (
            <option key={key} value={key}>
              {label(key)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {action === 'return' ? 'Reason for return' : 'Comment'}
        <textarea
          value={comment}
          required={action === 'return'}
          maxLength={4000}
          onChange={(event) => setComment(event.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button disabled={pending}>Submit action</button>
    </form>
  );
}
