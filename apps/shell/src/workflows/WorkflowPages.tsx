import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  workflowApi,
  type Asset,
  type Detail,
  type Instance,
  type ProposalLine,
  type RemovalRequest,
  type Result,
  type Task,
} from './api';
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
      <nav aria-label="Workflow pages">
        <Link to="/workflow/tasks">Task inbox</Link>
        <Link to="/workflow/monitor">Monitor</Link>
        <Link to={`/${removalPath}/new`}>Propose asset removal</Link>
      </nav>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function WorkflowInbox() {
  const state = useResource<Task[]>('workflow/tasks');
  return (
    <Frame title="Task inbox">
      <Resource state={state}>
        {(tasks) =>
          tasks.length ? (
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
          )
        }
      </Resource>
    </Frame>
  );
}

export function WorkflowMonitor() {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const state = useResource<Instance[]>(`workflow/instances${query ? `?${query}` : ''}`);
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
        {(instances) =>
          instances.length ? (
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
          )
        }
      </Resource>
    </Frame>
  );
}

export function WorkflowHistory() {
  const { id } = useParams();
  const state = useResource<Detail>(id && `workflow/instances/${id}`);
  return (
    <Frame title="Workflow history">
      <Resource state={state}>
        {(instance) => (
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
            {isRemoval(instance) && (
              <Link to={`/${removalPath}/${instance.subjectId}`}>View removal proposal</Link>
            )}
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
        )}
      </Resource>
    </Frame>
  );
}

function isRemoval(instance: Instance) {
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
      const result = await workflowApi<Result>(path, { body, key: retry.current.key });
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
  const state = useResource<Task>(id && `workflow/tasks/${id}`);
  return (
    <Frame title="Review task">
      <Resource state={state}>{(task) => <TaskBody key={task.id} task={task} />}</Resource>
    </Frame>
  );
}

function TaskBody({ task }: { task: Task }) {
  const removal = isRemoval(task.instance);
  const state = useResource<RemovalRequest>(
    removal ? `${removalPath}/${task.instance.subjectId}` : undefined,
  );
  return (
    <>
      <h3>{task.title}</h3>
      <p>
        {task.instance.title} · {task.status}
      </p>
      <p>{task.instructions}</p>
      <Link to={`/workflow/instances/${task.instance.id}`}>View workflow history</Link>
      {removal ? (
        <Resource state={state}>
          {(request) => (
            <>
              <ProposalHistory request={request} />
              <TaskActions task={task} request={request} />
            </>
          )}
        </Resource>
      ) : (
        <TaskActions task={task} />
      )}
    </>
  );
}

function TaskActions({ task, request }: { task: Task; request?: RemovalRequest }) {
  const [action, setAction] = useState(task.actions[0] ?? '');
  const [comment, setComment] = useState('');
  const { submit, pending, error } = useSubmit(`workflow/tasks/${task.id}/actions`);
  const items = request?.items.filter(({ revision }) => revision === request.currentRevision) ?? [];
  if (!task.actions.length) return <p>No actions are available.</p>;
  const controls = (
    <>
      <label>
        Action{' '}
        <select value={action} onChange={(event) => setAction(event.target.value)}>
          {task.actions.map((key) => (
            <option key={key} value={key}>
              {label(key)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {action === 'return' ? 'Reason for return' : 'Comment'}{' '}
        <textarea
          value={comment}
          required={action === 'return'}
          maxLength={4000}
          onChange={(event) => setComment(event.target.value)}
        />
      </label>
    </>
  );
  const finish = (input?: unknown) => void submit({ action, comment: comment || undefined, input });
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {action === 'resubmit' && request ? (
        <ProposalForm
          key={action}
          requestId={task.instance.subjectId}
          initial={items}
          onSubmit={(lines) => finish({ items: lines })}
          pending={pending}
        >
          {controls}
        </ProposalForm>
      ) : (
        <form
          key={action}
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            finish(
              action === 'record-decision' && request
                ? {
                    name: fields.get('name'),
                    reference: fields.get('reference'),
                    decidedOn: fields.get('decidedOn'),
                    items: items.map(({ assetId }) => ({
                      assetId,
                      outcome: fields.get(`outcome-${assetId}`),
                      reason: fields.get(`reason-${assetId}`),
                    })),
                  }
                : undefined,
            );
          }}
        >
          {controls}
          {action === 'record-decision' && request && (
            <>
              <label>
                Decision name <input name="name" required maxLength={200} />
              </label>
              <label>
                Reference <input name="reference" required maxLength={200} />
              </label>
              <label>
                Decision date <input name="decidedOn" type="date" required />
              </label>
              {items.map((item) => (
                <fieldset key={item.assetId}>
                  <legend>
                    {item.tag} · {item.name}
                  </legend>
                  <label>
                    Outcome{' '}
                    <select name={`outcome-${item.assetId}`} required defaultValue="">
                      <option value="" disabled>
                        Select outcome
                      </option>
                      <option value="approved-for-waste">Approved for waste</option>
                      <option value="rejected">Rejected</option>
                      <option value="deferred">Deferred</option>
                    </select>
                  </label>
                  <label>
                    Reason <textarea name={`reason-${item.assetId}`} required maxLength={2000} />
                  </label>
                </fieldset>
              ))}
            </>
          )}
          <button disabled={pending}>Submit action</button>
        </form>
      )}
    </>
  );
}

export function NewRemovalRequest() {
  const { submit, pending, error } = useSubmit(removalPath);
  return (
    <Frame title="Propose asset removal">
      {error && <p role="alert">{error}</p>}
      <ProposalForm onSubmit={(items) => void submit({ items })} pending={pending} />
    </Frame>
  );
}

export function RemovalRequestDetail() {
  const { id } = useParams();
  const state = useResource<RemovalRequest>(id && `${removalPath}/${id}`);
  return (
    <Frame title="Asset removal proposal">
      <Resource state={state}>
        {(request) => (
          <>
            <Link to={`/workflow/instances/${request.instanceId}`}>View workflow history</Link>
            <ProposalHistory request={request} />
          </>
        )}
      </Resource>
    </Frame>
  );
}

function ProposalHistory({ request }: { request: RemovalRequest }) {
  const revisions = [...new Set(request.items.map(({ revision }) => revision))].reverse();
  return (
    <>
      {request.decision && (
        <p>
          {request.decision.name} · {request.decision.reference} · {request.decision.decidedOn}
        </p>
      )}
      {revisions.map((revision) => (
        <section key={revision}>
          <h4>
            Revision {revision}
            {revision === request.currentRevision ? ' (current)' : ''}
          </h4>
          <ul>
            {request.items
              .filter((line) => line.revision === revision)
              .map((item) => (
                <li key={item.assetId}>
                  <strong>
                    {item.tag} · {item.name}
                  </strong>
                  <p>{item.reason}</p>
                  {item.outcome && (
                    <p>
                      {label(item.outcome)} · {item.decisionReason}
                    </p>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function ProposalForm({
  requestId,
  initial,
  onSubmit,
  pending,
  children,
}: {
  requestId?: string;
  initial?: ProposalLine[];
  onSubmit: (items: ProposalLine[]) => void;
  pending: boolean;
  children?: ReactNode;
}) {
  const assets = useResource<Asset[]>(
    `inventory/workflow/assets${requestId ? `?requestId=${encodeURIComponent(requestId)}` : ''}`,
  );
  const [lines, setLines] = useState(() =>
    (initial?.length ? initial : [{ assetId: '', reason: '' }]).map(
      ({ assetId, reason }, index) => ({ assetId, reason, key: index }),
    ),
  );
  const nextKey = useRef(lines.length);
  function update(key: number, patch: Partial<ProposalLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(lines.map(({ assetId, reason }) => ({ assetId, reason })));
      }}
    >
      {children}
      <Resource state={assets}>
        {(all) => {
          const active = all.filter(({ status }) => status === 'active');
          if (!active.length && !initial?.length)
            return <p>No active Inventory assets are available.</p>;
          return (
            <>
              {lines.map((line) => (
                <fieldset key={line.key}>
                  <legend>Proposed asset</legend>
                  <label>
                    Asset{' '}
                    <select
                      required
                      value={line.assetId}
                      onChange={(event) => update(line.key, { assetId: event.target.value })}
                    >
                      <option value="" disabled>
                        Select asset
                      </option>
                      {line.assetId && !active.some(({ id }) => id === line.assetId) && (
                        <option value={line.assetId} disabled>
                          Asset no longer active
                        </option>
                      )}
                      {active
                        .filter(
                          ({ id }) =>
                            id === line.assetId || !lines.some(({ assetId }) => assetId === id),
                        )
                        .map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.tag} · {asset.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Removal reason{' '}
                    <textarea
                      required
                      maxLength={2000}
                      value={line.reason}
                      onChange={(event) => update(line.key, { reason: event.target.value })}
                    />
                  </label>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setLines((current) => current.filter(({ key }) => key !== line.key))
                      }
                    >
                      Remove asset
                    </button>
                  )}
                </fieldset>
              ))}
              <button
                type="button"
                disabled={lines.length >= Math.min(active.length, 100)}
                onClick={() => {
                  const key = nextKey.current++;
                  setLines((current) => [...current, { assetId: '', reason: '', key }]);
                }}
              >
                Add asset
              </button>
              <button
                disabled={
                  pending || lines.some(({ assetId }) => !active.some(({ id }) => id === assetId))
                }
              >
                Submit proposal
              </button>
            </>
          );
        }}
      </Resource>
    </form>
  );
}
