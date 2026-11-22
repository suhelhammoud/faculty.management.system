import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type {
  DesignDocument,
  DesignStep,
  DesignTransition,
  WorkflowDraft,
} from '@project/contracts/workflow';
import { request, DesignError, type Access } from './designer-api';
import { Canvas, ends } from './DesignCanvas';
import { RuleEditor } from './DesignRuleEditor';
import './workflows.css';

type Summary = { id: string; title: string; updatedBy: string; updatedAt: string };
type Catalog = { templates: DesignDocument[]; permissions: string[] };
const blank = (): DesignDocument => ({
  key: '',
  version: 1,
  title: 'Untitled workflow',
  description: '',
  initialStep: '',
  steps: [],
});
export default function Designer() {
  const { id } = useParams();
  return <DesignerPage key={id ?? 'list'} id={id} />;
}
function DesignerPage({ id }: { id?: string }) {
  const nav = useNavigate();
  const [catalog, setCatalog] = useState<Catalog>();
  const [editable, setEditable] = useState(false);
  const [rows, setRows] = useState<Summary[]>([]);
  const [doc, setDoc] = useState<DesignDocument>();
  const [revision, setRevision] = useState(0);
  const [selected, select] = useState('');
  const [error, fail] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [source, setSource] = useState('');
  function load(row: WorkflowDraft) {
    setDoc(row.document);
    setRevision(row.revision);
    select(row.document.steps[0]?.id ?? '');
    setDirty(false);
    setConflict(false);
  }
  useEffect(() => {
    const ac = new AbortController();
    const get = <T,>(p: string) => request<T>(p, 'GET', undefined, ac.signal);
    void (async () => {
      const access = await get<Access>('capabilities');
      if (!access.canRead) throw Error('Workflow designer access is required.');
      const c = await get<Catalog>('catalog');
      if (id) load(await get<WorkflowDraft>('drafts/' + id));
      else setRows(await get<Summary[]>('drafts'));
      setEditable(access.canEdit);
      setCatalog(c);
    })().catch((e) => {
      if (!ac.signal.aborted) fail(e.message);
    });
    return () => ac.abort();
  }, [id]);
  async function run(fn: () => Promise<void>) {
    fail('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Request failed');
      if (e instanceof DesignError && e.status === 409) setConflict(true);
    } finally {
      setBusy(false);
    }
  }
  async function create(d: DesignDocument) {
    const row = await request<WorkflowDraft>('drafts', 'POST', d);
    void nav('/workflow/designer/' + row.id);
  }
  function change(d: DesignDocument) {
    setDoc(d);
    setDirty(true);
  }
  const step = doc?.steps.find((s) => s.id === selected);
  function patchStep(p: Partial<DesignStep>) {
    if (doc)
      change({ ...doc, steps: doc.steps.map((s) => (s.id === selected ? { ...s, ...p } : s)) });
  }
  return (
    <section className="workflow-page designer">
      <nav>
        <Link to="/workflow/tasks">Task inbox</Link> ·{' '}
        <Link to="/workflow/designer">Shared designs</Link>
      </nav>
      <h1>{id ? 'Workflow editor' : 'Workflow designer'}</h1>
      {error && (
        <p role="alert" style={{ whiteSpace: 'pre-line' }}>
          {error}
        </p>
      )}
      {!catalog ? (
        !error && <p role="status">Loading…</p>
      ) : !id ? (
        <>
          {editable && (
            <div className="design-tools">
              <label>
                Starting workflow
                <select value={source} onChange={(e) => setSource(e.target.value)}>
                  <option value="">Blank workflow</option>
                  {catalog.templates.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={busy}
                onClick={() =>
                  void run(() => create(catalog.templates.find((t) => t.key === source) ?? blank()))
                }
              >
                Create draft
              </button>
            </div>
          )}
          {rows.length ? (
            <ul>
              {rows.map((r) => (
                <li key={r.id}>
                  <Link to={r.id}>{r.title || 'Untitled workflow'}</Link> · {r.updatedBy} ·{' '}
                  {new Date(r.updatedAt).toLocaleString()}
                </li>
              ))}
            </ul>
          ) : (
            <p>No shared drafts yet.</p>
          )}
        </>
      ) : (
        doc && (
          <>
            <div className="design-tools">
              {editable && (
                <button
                  disabled={busy || !dirty || conflict}
                  onClick={() =>
                    void run(async () => {
                      const row = await request<WorkflowDraft>('drafts/' + id, 'PUT', {
                        revision,
                        document: doc,
                      });
                      setRevision(row.revision);
                      setDirty(false);
                    })
                  }
                >
                  Save draft
                </button>
              )}
              <button
                disabled={busy || dirty}
                onClick={() =>
                  void run(async () => {
                    const result = await request('drafts/' + id + '/export');
                    const url = URL.createObjectURL(
                      new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }),
                    );
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = doc.key + '.json';
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  })
                }
              >
                Export definition
              </button>
              <span role="status">
                {dirty ? 'Unsaved changes' : editable ? 'Saved' : 'Read only'}
              </span>
              {conflict && (
                <>
                  <button
                    disabled={busy}
                    onClick={() => void run(async () => load(await request('drafts/' + id)))}
                  >
                    Reload latest
                  </button>
                  <button disabled={busy} onClick={() => void run(() => create(doc))}>
                    Save as new draft
                  </button>
                </>
              )}
            </div>
            <fieldset disabled={!editable || busy} className="design-tools">
              {(['title', 'key', 'description'] as const).map((k) => (
                <label key={k}>
                  Workflow {k}
                  <input value={doc[k]} onChange={(e) => change({ ...doc, [k]: e.target.value })} />
                </label>
              ))}
              <label>
                Definition version
                <input
                  type="number"
                  min="1"
                  value={doc.version}
                  onChange={(e) => change({ ...doc, version: Number(e.target.value) })}
                />
              </label>
              <label>
                Initial step
                <select
                  value={doc.initialStep}
                  onChange={(e) => change({ ...doc, initialStep: e.target.value })}
                >
                  <option value="">Choose step</option>
                  {doc.steps.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => {
                  const id = crypto.randomUUID();
                  const n = doc.steps.length;
                  change({
                    ...doc,
                    initialStep: doc.initialStep || id,
                    steps: [
                      ...doc.steps,
                      {
                        id,
                        key: 'step-' + (n + 1),
                        title: 'Step ' + (n + 1),
                        instructions: '',
                        eligible: { requester: true },
                        actions: [],
                        x: 30 + (n % 3) * 250,
                        y: 50 + Math.floor(n / 3) * 170,
                      },
                    ],
                  });
                  select(id);
                }}
              >
                Add step
              </button>
            </fieldset>
            <div className="design-workspace">
              <Canvas
                doc={doc}
                selected={selected}
                select={select}
                move={
                  editable && !busy
                    ? (id, x, y) =>
                        change({
                          ...doc,
                          steps: doc.steps.map((s) => (s.id === id ? { ...s, x, y } : s)),
                        })
                    : undefined
                }
              />
              {step && (
                <fieldset key={step.id} disabled={!editable || busy} className="design-inspector">
                  <legend>Step properties</legend>
                  {(['title', 'key', 'instructions'] as const).map((k) => (
                    <label key={k}>
                      Step {k}
                      <input value={step[k]} onChange={(e) => patchStep({ [k]: e.target.value })} />
                    </label>
                  ))}
                  <RuleEditor
                    name="Eligibility"
                    rule={step.eligible}
                    update={(eligible) => patchStep({ eligible: eligible ?? {} })}
                    permissions={catalog.permissions}
                  />
                  <RuleEditor
                    name="Withdrawal"
                    rule={step.withdraw}
                    update={(withdraw) => patchStep({ withdraw })}
                    permissions={catalog.permissions}
                    optional
                  />
                  <h3>Actions</h3>
                  {step.actions.map((a, i) => {
                    function edit(key: string, target: DesignTransition) {
                      patchStep({
                        actions: step!.actions.map((old, j) => (i === j ? { key, target } : old)),
                      });
                    }
                    return (
                      <div className="design-tools" key={i}>
                        <label>
                          Action key
                          <input value={a.key} onChange={(e) => edit(e.target.value, a.target)} />
                        </label>
                        <label>
                          Destination
                          <select
                            value={'next' in a.target ? 'step:' + a.target.next : a.target.finish}
                            onChange={(e) => {
                              const v = e.target.value;
                              edit(
                                a.key,
                                v.startsWith('step:')
                                  ? { next: v.slice(5) }
                                  : { finish: v as 'completed' | 'rejected' | 'cancelled' },
                              );
                            }}
                          >
                            <option value="step:">Choose destination</option>
                            {doc.steps.map((s) => (
                              <option value={'step:' + s.id} key={s.id}>
                                {s.title}
                              </option>
                            ))}
                            {ends.map((v) => (
                              <option key={v} value={v}>
                                Finish · {v}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          onClick={() =>
                            patchStep({ actions: step.actions.filter((_, j) => j !== i) })
                          }
                        >
                          Remove action
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={() =>
                      patchStep({ actions: [...step.actions, { key: '', target: { next: '' } }] })
                    }
                  >
                    Add action
                  </button>
                  <button
                    onClick={() => {
                      if (!window.confirm('Remove this step and its incoming actions?')) return;
                      const steps = doc.steps
                        .filter((s) => s.id !== step.id)
                        .map((s) => ({
                          ...s,
                          actions: s.actions.filter(
                            (a) => !('next' in a.target && a.target.next === step.id),
                          ),
                        }));
                      change({
                        ...doc,
                        steps,
                        initialStep: doc.initialStep === step.id ? '' : doc.initialStep,
                      });
                      select(steps[0]?.id ?? '');
                    }}
                  >
                    Remove step
                  </button>
                </fieldset>
              )}
            </div>
          </>
        )
      )}
    </section>
  );
}
