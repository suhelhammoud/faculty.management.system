import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ApiError, asQuery, useResource, useWrite, workflow } from '../lib/api';
import type {
  WorkflowActionResult,
  WorkflowInstance,
  WorkflowInstanceDetail,
  WorkflowTask,
} from '@project/contracts/workflow';
import type { ProposalLine, RemovalAssetOption, RemovalRequest } from '../lib/removal-types';
import {
  bidi,
  Choice,
  ErrorMessage,
  Field,
  Grid,
  Resource,
  useDate,
  useFilters,
} from '../components/common';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { NativeSelect } from '../components/ui/native-select';

const removal = 'inventory/workflow/removal-requests';
const inventoryOnly = (instance: WorkflowInstance) =>
  instance.subjectModule === 'inventory' && instance.subjectType === 'removal-request';
const steps = ['review', 'revise', 'committee-decision'];
const statuses = ['running', 'completed', 'rejected', 'cancelled'];
const instructions: Record<string, string> = {
  review: 'Review the proposed assets and reasons.',
  revise: 'Revise the proposal and submit it again.',
  'committee-decision': 'Record one outcome and reason for each asset.',
};

export function InboxPage() {
  const { t } = useTranslation();
  const query = useResource<WorkflowTask[]>('workflow/tasks', true, true);
  return (
    <section>
      <h2>{t('Task inbox')}</h2>
      <Resource query={query}>
        {(tasks) => (
          <Grid
            columns={['Step', 'Lifecycle']}
            rows={tasks
              .filter((task) => inventoryOnly(task.instance))
              .map((task) => ({
                id: task.id,
                cells: [
                  <Link to={`${workflow}/tasks/${task.id}`}>{t(task.step)}</Link>,
                  t(task.status),
                ],
              }))}
          />
        )}
      </Resource>
    </section>
  );
}
export function MonitorPage() {
  const { t } = useTranslation();
  const filters = useFilters();
  const date = useDate();
  const query = useResource<WorkflowInstance[]>(
    asQuery('workflow/instances', { status: filters.get('status'), step: filters.get('step') }),
  );
  return (
    <section className="inv-stack">
      <h2>{t('Monitor')}</h2>
      <div className="inv-fields inv-panel">
        <Choice
          label="Lifecycle"
          value={filters.get('status')}
          onChange={(value) => filters.update('status', value)}
          choices={statuses}
          optional
        />
        <Choice
          label="Step"
          value={filters.get('step')}
          onChange={(value) => filters.update('step', value)}
          choices={steps}
          optional
        />
      </div>
      <Resource query={query}>
        {(items) => (
          <Grid
            columns={['Removal proposal', 'Lifecycle', 'Step', 'Last activity']}
            rows={items.filter(inventoryOnly).map((item) => ({
              id: item.id,
              cells: [
                <Link to={`${workflow}/instances/${item.id}`}>{t('Workflow history')}</Link>,
                t(item.status),
                item.currentStep ? t(item.currentStep) : '—',
                date(item.lastActivityAt),
              ],
            }))}
          />
        )}
      </Resource>
    </section>
  );
}
export function InstancePage() {
  const { t } = useTranslation();
  const date = useDate();
  const { id } = useParams();
  const query = useResource<WorkflowInstanceDetail>(`workflow/instances/${id}`, !!id, true);
  return (
    <Resource query={query}>
      {(item) =>
        inventoryOnly(item) ? (
          <section className="inv-stack">
            <h2>{t('Workflow history')}</h2>
            <p>
              {t(item.status)}
              {item.currentStep && ` · ${t(item.currentStep)}`}
            </p>
            <div className="inv-actions">
              <Link to={`${workflow}/removal-requests/${item.subjectId}`}>
                {t('Removal proposal')}
              </Link>
              {item.currentTaskId && (
                <Link to={`${workflow}/tasks/${item.currentTaskId}`}>{t('Current task')}</Link>
              )}
            </div>
            <Grid
              columns={['Action', 'Recorded at', 'Actor ID', 'Comment']}
              rows={item.history.map((event) => ({
                id: event.id,
                cells: [
                  t(event.action),
                  date(event.occurredAt),
                  bidi(event.actorId),
                  bidi(event.comment),
                ],
              }))}
            />
          </section>
        ) : (
          <p role="alert">{t('Record not found')}</p>
        )
      }
    </Resource>
  );
}

function Revisions({ request }: { request: RemovalRequest }) {
  const { t } = useTranslation();
  const date = useDate();
  const revisions = Array.from(new Set(request.items.map((row) => row.revision))).sort(
    (a, b) => b - a,
  );
  return (
    <div className="inv-stack">
      {request.decision && (
        <p className="inv-panel">
          {bidi(request.decision.name)} · {bidi(request.decision.reference)} ·{' '}
          {date(request.decision.decidedOn, true)}
        </p>
      )}
      {revisions.map((number) => (
        <section key={number} className="inv-panel inv-stack">
          <h3>
            {t('Revision {{number}}', { number })}
            {number === request.currentRevision && ` · ${t('Current')}`}
          </h3>
          <Grid
            columns={['Tag', 'Asset', 'Condition', 'Removal reason', 'Outcome', 'Reason']}
            rows={request.items
              .filter((row) => row.revision === number)
              .map((row) => ({
                id: row.assetId,
                cells: [
                  bidi(row.tag),
                  bidi(row.name),
                  row.condition ? t(row.condition) : '—',
                  bidi(row.reason),
                  row.outcome ? t(row.outcome) : '—',
                  bidi(row.decisionReason),
                ],
              }))}
          />
        </section>
      ))}
    </div>
  );
}
export function ProposalPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const query = useResource<RemovalRequest>(`${removal}/${id}`, !!id, true);
  return (
    <Resource query={query}>
      {(request) => (
        <section className="inv-stack">
          <h2>{t('Removal proposal')}</h2>
          <Link to={`${workflow}/instances/${request.instanceId}`}>{t('Workflow history')}</Link>
          <Revisions request={request} />
        </section>
      )}
    </Resource>
  );
}

function ProposalForm({
  requestId,
  initial = [],
  pending,
  submit,
  children,
}: {
  requestId?: string;
  initial?: ProposalLine[];
  pending: boolean;
  submit: (items: ProposalLine[]) => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const query = useResource<RemovalAssetOption[]>(
    asQuery('inventory/workflow/assets', { requestId }),
  );
  const [lines, setLines] = useState(() =>
    (initial.length ? initial : [{ assetId: '', reason: '' }]).map((row) => ({
      ...row,
      key: crypto.randomUUID(),
      q: '',
    })),
  );
  const change = (key: string, patch: Partial<(typeof lines)[number]>) =>
    setLines((before) => before.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  return (
    <Resource query={query}>
      {(assets) => {
        const active = assets.filter(({ status }) => status === 'active');
        return (
          <form
            className="inv-stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                lines.every(
                  ({ assetId, reason }) => reason.trim() && active.some(({ id }) => id === assetId),
                )
              )
                submit(lines.map(({ assetId, reason }) => ({ assetId, reason: reason.trim() })));
            }}
          >
            <fieldset disabled={pending} className="inv-stack">
              {children}
              {!active.length && <p role="status">{t('No active assets are available.')}</p>}
              {lines.map((row) => {
                const search = row.q.trim().toLowerCase();
                const options = active.filter(
                  ({ id, tag, name }) =>
                    id === row.assetId ||
                    (!lines.some((other) => other.assetId === id) &&
                      `${tag} ${name}`.toLowerCase().includes(search)),
                );
                return (
                  <fieldset key={row.key} className="inv-panel inv-fields">
                    <legend>{t('Asset')}</legend>
                    <Field label="Search">
                      <Input
                        value={row.q}
                        onChange={(event) => change(row.key, { q: event.target.value })}
                      />
                    </Field>
                    <Field label="Asset">
                      <NativeSelect
                        required
                        value={row.assetId}
                        onChange={(event) => change(row.key, { assetId: event.target.value })}
                      >
                        <option value="">{t('Select an option')}</option>
                        {row.assetId && !options.some(({ id }) => id === row.assetId) && (
                          <option value={row.assetId} disabled>
                            {t('Asset is no longer eligible.')}
                          </option>
                        )}
                        {options.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.tag} · {asset.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field label="Removal reason">
                      <Textarea
                        required
                        maxLength={2000}
                        value={row.reason}
                        onChange={(event) => change(row.key, { reason: event.target.value })}
                      />
                    </Field>
                    {lines.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setLines((list) => list.filter(({ key }) => key !== row.key))
                        }
                      >
                        {t('Remove')}
                      </Button>
                    )}
                  </fieldset>
                );
              })}
              <div className="inv-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={lines.length >= Math.min(active.length, 100)}
                  onClick={() =>
                    setLines((list) => [
                      ...list,
                      { key: crypto.randomUUID(), assetId: '', reason: '', q: '' },
                    ])
                  }
                >
                  {t('Add line')}
                </Button>
                <Button
                  disabled={lines.some(
                    ({ assetId, reason }) =>
                      !reason.trim() || !active.some(({ id }) => id === assetId),
                  )}
                >
                  {t(pending ? 'Saving…' : requestId ? 'resubmit' : 'Submit proposal')}
                </Button>
              </div>
            </fieldset>
          </form>
        );
      }}
    </Resource>
  );
}
export function NewProposalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const write = useWrite<WorkflowActionResult>(removal);
  return (
    <section className="inv-stack">
      <h2>{t('Propose asset removal')}</h2>
      <ProposalForm
        pending={write.isPending}
        submit={(items) =>
          write.mutate(
            { items },
            { onSuccess: ({ instanceId }) => void navigate(`${workflow}/instances/${instanceId}`) },
          )
        }
      />
      <ErrorMessage error={write.error} />
    </section>
  );
}

type Submit = (action: string, comment?: string, input?: unknown) => void;
type DecisionItem = RemovalRequest['items'][number];
function ReviewActions({
  actions,
  pending,
  submit,
  committeeItems,
}: {
  actions: string[];
  pending: boolean;
  submit: Submit;
  committeeItems?: DecisionItem[];
}) {
  const { t } = useTranslation();
  const [action, setAction] = useState(actions[0]);
  const [comment, setComment] = useState('');
  const decision = action === 'record-decision' && committeeItems;
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action === 'return' && !comment.trim()) return;
    const fields = new FormData(event.currentTarget);
    const value = (key: string) => String(fields.get(key) ?? '').trim();
    const input = decision
      ? {
          name: value('name'),
          reference: value('reference'),
          decidedOn: value('decidedOn'),
          items: decision.map(({ assetId }) => ({
            assetId,
            outcome: value(`outcome-${assetId}`),
            reason: value(`reason-${assetId}`),
          })),
        }
      : undefined;
    if (
      input &&
      (!input.name || !input.reference || input.items.some((item) => !item.outcome || !item.reason))
    )
      return;
    submit(action, comment.trim() || undefined, input);
  }
  return (
    <form onSubmit={send} className="inv-panel inv-stack">
      <fieldset disabled={pending} className="inv-stack">
        <Choice
          label="Action"
          choices={actions}
          value={action}
          onChange={(next) => {
            if (next) setAction(next);
          }}
        />
        <Field label={action === 'return' ? 'Reason' : 'Comment'}>
          <Textarea
            required={action === 'return'}
            maxLength={4000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </Field>
        {decision && (
          <>
            <div className="inv-fields">
              <Field label="Decision name">
                <Input name="name" maxLength={200} required />
              </Field>
              <Field label="Reference">
                <Input name="reference" maxLength={200} required />
              </Field>
              <Field label="Decision date">
                <Input name="decidedOn" type="date" required />
              </Field>
            </div>
            {decision.map((item) => (
              <fieldset key={item.assetId} className="inv-fields">
                <legend>
                  {bidi(item.tag)} · {bidi(item.name)}
                </legend>
                <Field label="Outcome">
                  <NativeSelect name={`outcome-${item.assetId}`} required defaultValue="">
                    <option value="">{t('Select an option')}</option>
                    {['approved-for-waste', 'rejected', 'deferred'].map((key) => (
                      <option key={key} value={key}>
                        {t(key)}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Reason">
                  <Textarea required name={`reason-${item.assetId}`} maxLength={2000} />
                </Field>
              </fieldset>
            ))}
          </>
        )}
        <Button disabled={action === 'return' && !comment.trim()}>
          {t(pending ? 'Saving…' : 'Submit action')}
        </Button>
      </fieldset>
    </form>
  );
}
function ReviseForm({
  id,
  items,
  pending,
  submit,
}: {
  id: string;
  items: DecisionItem[];
  pending: boolean;
  submit: Submit;
}) {
  const [comment, setComment] = useState('');
  return (
    <ProposalForm
      requestId={id}
      initial={items}
      pending={pending}
      submit={(revised) => submit('resubmit', comment.trim() || undefined, { items: revised })}
    >
      <Field label="Comment">
        <Textarea
          maxLength={4000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </Field>
    </ProposalForm>
  );
}
function TaskDetail({ task, reload }: { task: WorkflowTask; reload: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useResource<RemovalRequest>(`${removal}/${task.instance.subjectId}`, true, true);
  const write = useWrite<WorkflowActionResult>(`workflow/tasks/${task.id}/actions`);
  const submit: Submit = (action, comment, input) =>
    write.mutate(
      { action, comment, input },
      {
        onSuccess: ({ instanceId }) => void navigate(`${workflow}/instances/${instanceId}`),
        onError: (error) => {
          if (
            error instanceof ApiError &&
            (error.status === 403 || error.message === 'This task is no longer pending')
          )
            reload();
        },
      },
    );
  return (
    <section className="inv-stack">
      <h2>{t(task.step)}</h2>
      <p>{t(instructions[task.step] ?? task.instructions)}</p>
      <Link to={`${workflow}/instances/${task.instance.id}`}>{t('Workflow history')}</Link>
      <ErrorMessage error={write.error} />
      <Resource query={query}>
        {(request) => {
          const items = request.items.filter(
            ({ revision }) => revision === request.currentRevision,
          );
          return (
            <>
              <Revisions request={request} />
              {!task.actions.length ? (
                <p>{t('No actions are available.')}</p>
              ) : task.step === 'revise' ? (
                <ReviseForm
                  id={task.instance.subjectId}
                  items={items}
                  pending={write.isPending}
                  submit={submit}
                />
              ) : (
                <ReviewActions
                  key={task.actions.join(',')}
                  actions={task.actions}
                  pending={write.isPending}
                  submit={submit}
                  committeeItems={task.step === 'committee-decision' ? items : undefined}
                />
              )}
            </>
          );
        }}
      </Resource>
    </section>
  );
}
export function TaskPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const query = useResource<WorkflowTask>(`workflow/tasks/${id}`, !!id, true);
  return (
    <Resource query={query}>
      {(item) =>
        inventoryOnly(item.instance) ? (
          <TaskDetail key={item.id} task={item} reload={() => void query.refetch()} />
        ) : (
          <p role="alert">{t('Record not found')}</p>
        )
      }
    </Resource>
  );
}
