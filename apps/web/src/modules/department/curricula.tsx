import { useRef, useState, type FormEvent } from 'react';
import { DateInput, formatDate } from '@/components/ui/date-input';
import { Link, useNavigate, useParams } from 'react-router';
import type {
  CurriculumDetail,
  CurriculumModule,
  CurriculumPlanMetadata,
  CurriculumVersion,
} from '@project/contracts/department';
import { Button, Field, Input, Resource, years } from '../student-affairs/common';
import { useDepartmentRead, useDepartmentWrite } from './api';

const assessmentFields = [
  ['theoryMarks', 'Theory marks'],
  ['practicalMarks', 'Practical marks'],
  ['totalMarks', 'Total marks'],
  ['progressMarks', 'Project progress marks'],
] as const;
const optionalNumericFields = [['credits', 'Credits'], ...assessmentFields] as const;

const planDetails = [
  ['description', 'Description'],
  ['adoptionDate', 'Adoption date'],
  ['ministryDecision', 'Ministry decision'],
  ['remarks', 'Remarks'],
] as const;

type Row = CurriculumModule & { key: number };

export function DepartmentError({ error }: { error: Error | null }) {
  return (
    error && (
      <p role="alert" className="sta-error">
        {error.message || 'Unable to complete the request.'}
      </p>
    )
  );
}

export function versionLabel(plan: Pick<CurriculumVersion, 'name' | 'version'>) {
  return `${plan.name} · v${plan.version}`;
}

export function CurriculumRoute({ canManage }: { canManage: boolean }) {
  const { versionId } = useParams();
  const query = useDepartmentRead<CurriculumDetail>(
    `/curricula/${versionId}`,
    Boolean(versionId),
    false,
  );
  return (
    <Resource query={query}>
      {(plan) => (
        <CurriculumDetailView
          key={`${plan.id}/${plan.revision}/${plan.publishedAt}`}
          plan={plan}
          canManage={canManage}
        />
      )}
    </Resource>
  );
}

function CurriculumDetailView({ plan, canManage }: { plan: CurriculumDetail; canManage: boolean }) {
  const department = useDepartmentRead<{ id: string; active: boolean }[]>();
  const active =
    department.data?.some(({ id, active }) => id === plan.departmentId && active) ?? false;
  const draft = useDepartmentWrite<CurriculumVersion>();
  const navigate = useNavigate();
  const editable = canManage && active && !plan.publishedAt;

  return (
    <section className="sta-stack">
      <Link to={`/department?department=${plan.departmentId}`}>Back to department</Link>
      <h2>
        {versionLabel(plan)} · {plan.publishedAt ? 'Published' : 'Draft'}
      </h2>
      {!editable && (
        <dl className="sta-panel sta-fields">
          {planDetails.map(([key, label]) => {
            const value = plan[key];
            return (
              <div key={key}>
                <dt>{label}</dt>
                <dd className="whitespace-pre-wrap" dir="auto">
                  {key === 'adoptionDate' && value ? formatDate(value) : (value ?? '—')}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      {canManage && active && plan.publishedAt && (
        <div>
          <Button
            type="button"
            disabled={draft.isPending}
            onClick={() =>
              draft.mutate(
                { path: `/curricula/families/${plan.familyId}/drafts` },
                {
                  onSuccess: ({ id }) => void navigate(`/department/curricula/${id}`),
                },
              )
            }
          >
            Open next draft
          </Button>
          <DepartmentError error={draft.error} />
        </div>
      )}
      {plan.modules.some(({ progressMarks }) => progressMarks != null) && (
        <p>For projects spanning two semesters, progress marks apply to the whole project.</p>
      )}
      {editable ? (
        <DraftEditor plan={plan} />
      ) : (
        years.map((year) => (
          <section className="sta-panel sta-stack" key={year}>
            <h3>Year {year}</h3>
            {[1, 2].map((semester) => {
              const rows = plan.modules.filter(
                (row) => row.studyYear === year && row.semester === semester,
              );
              return (
                <div className="sta-stack" key={semester}>
                  <h4>Semester {semester}</h4>
                  {rows.length ? (
                    <div className="sta-table">
                      <table>
                        <thead>
                          <tr>
                            {[
                              'Code',
                              'Module',
                              'Theory hours/week',
                              'Lab hours/week',
                              'Credits',
                              ...assessmentFields.map(([, label]) => label),
                              'Requirement',
                            ].map((label) => (
                              <th key={label}>{label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, index) => (
                            <tr key={index}>
                              <td>
                                <bdi>{row.code}</bdi>
                              </td>
                              <td>
                                <bdi>{row.name}</bdi>
                                {row.nameAr && (
                                  <div>
                                    <bdi lang="ar" dir="rtl">
                                      {row.nameAr}
                                    </bdi>
                                  </div>
                                )}
                              </td>
                              <td>{row.theoryHours}</td>
                              <td>{row.labHours}</td>
                              <td>{row.credits ?? '—'}</td>
                              {assessmentFields.map(([key]) => (
                                <td key={key}>{row[key] ?? '—'}</td>
                              ))}
                              <td>{row.requirement}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>No modules.</p>
                  )}
                </div>
              );
            })}
          </section>
        ))
      )}
    </section>
  );
}

function DraftEditor({ plan }: { plan: CurriculumDetail }) {
  const [name, setName] = useState(plan.name);
  const [details, setDetails] = useState({
    description: plan.description ?? '',
    adoptionDate: plan.adoptionDate ?? '',
    ministryDecision: plan.ministryDecision ?? '',
    remarks: plan.remarks ?? '',
  });
  const nextKey = useRef(plan.modules.length);
  const [rows, setRows] = useState<Row[]>(() => plan.modules.map((row, key) => ({ ...row, key })));
  const [dirty, setDirty] = useState(false);
  const [allowEmptySemesters, setAllowEmptySemesters] = useState(false);
  const save = useDepartmentWrite();
  const publish = useDepartmentWrite();
  const busy = save.isPending || publish.isPending;
  const emptyCount = 10 - new Set(rows.map((row) => `${row.studyYear}/${row.semester}`)).size;

  function updateDetail(key: keyof CurriculumPlanMetadata, value: string) {
    setDetails((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
  }

  function update(key: number, changes: Partial<CurriculumModule>) {
    setDirty(true);
    setRows((previous) => previous.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  }

  function changeRows(next: Row[]) {
    setRows(next);
    setDirty(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate({
      path: `/curricula/${plan.id}`,
      method: 'PATCH',
      body: {
        name,
        description: details.description.trim() || null,
        adoptionDate: details.adoptionDate || null,
        ministryDecision: details.ministryDecision.trim() || null,
        remarks: details.remarks.trim() || null,
        expectedRevision: plan.revision,
        modules: rows.map(
          ({
            studyYear,
            semester,
            code,
            name,
            nameAr,
            theoryHours,
            labHours,
            credits,
            theoryMarks,
            practicalMarks,
            totalMarks,
            progressMarks,
            requirement,
          }) => ({
            studyYear,
            semester,
            code,
            name,
            nameAr: nameAr?.trim() || null,
            theoryHours,
            labHours,
            credits,
            theoryMarks,
            practicalMarks,
            totalMarks,
            progressMarks,
            requirement,
          }),
        ),
      },
    });
  }

  return (
    <form onSubmit={submit} className="sta-stack">
      <fieldset disabled={busy} className="sta-stack">
        <Field label="Plan title">
          <Input
            value={name}
            required
            maxLength={200}
            onChange={(event) => {
              setName(event.target.value);
              setDirty(true);
            }}
          />
        </Field>
        <div className="sta-panel sta-fields">
          <Field label="Description">
            <textarea
              data-slot="textarea"
              dir="auto"
              maxLength={5000}
              rows={3}
              value={details.description}
              onChange={(event) => updateDetail('description', event.target.value)}
            />
          </Field>
          <Field label="Adoption date">
            <DateInput
              data-slot="input"
              value={details.adoptionDate}
              onValueChange={(value) => updateDetail('adoptionDate', value)}
            />
          </Field>
          <Field label="Ministry decision">
            <Input
              dir="auto"
              maxLength={500}
              value={details.ministryDecision}
              onChange={(event) => updateDetail('ministryDecision', event.target.value)}
            />
          </Field>
          <Field label="Remarks">
            <textarea
              data-slot="textarea"
              dir="auto"
              maxLength={5000}
              rows={3}
              value={details.remarks}
              onChange={(event) => updateDetail('remarks', event.target.value)}
            />
          </Field>
        </div>
        {years.map((studyYear) => (
          <section className="sta-panel sta-stack" key={studyYear}>
            <h3>Year {studyYear}</h3>
            {[1, 2].map((semester) => (
              <fieldset key={semester} className="sta-panel sta-stack">
                <legend>Semester {semester}</legend>
                {rows
                  .filter((row) => row.studyYear === studyYear && row.semester === semester)
                  .map((row, index) => (
                    <fieldset className="sta-fields" key={row.key}>
                      <legend>Module {index + 1}</legend>
                      <Field label="Code">
                        <Input
                          value={row.code}
                          maxLength={80}
                          required
                          onChange={(event) => update(row.key, { code: event.target.value })}
                        />
                      </Field>
                      <Field label="English name">
                        <Input
                          value={row.name}
                          maxLength={200}
                          required
                          onChange={(event) => update(row.key, { name: event.target.value })}
                        />
                      </Field>
                      <Field label="Arabic name">
                        <Input
                          value={row.nameAr ?? ''}
                          lang="ar"
                          dir="rtl"
                          maxLength={200}
                          onChange={(event) => update(row.key, { nameAr: event.target.value })}
                        />
                      </Field>
                      {(
                        [
                          ['theoryHours', 'Theory hours/week', 80],
                          ['labHours', 'Lab hours/week', 80],
                        ] as const
                      ).map(([key, label, max]) => (
                        <Field label={label} key={key}>
                          <Input
                            type="number"
                            min={0}
                            max={max}
                            required
                            value={row[key]}
                            onChange={(event) =>
                              update(row.key, { [key]: Number(event.target.value) })
                            }
                          />
                        </Field>
                      ))}
                      {optionalNumericFields.map(([key, label]) => (
                        <Field label={label} key={key}>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={row[key] ?? ''}
                            onChange={(event) =>
                              update(row.key, {
                                [key]:
                                  event.target.value === '' ? null : Number(event.target.value),
                              })
                            }
                          />
                        </Field>
                      ))}
                      <Field label="Requirement">
                        <select
                          value={row.requirement}
                          onChange={(event) =>
                            update(row.key, {
                              requirement:
                                event.target.value === 'elective' ? 'elective' : 'required',
                            })
                          }
                        >
                          <option value="required">Required</option>
                          <option value="elective">Elective</option>
                        </select>
                      </Field>
                      <div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => changeRows(rows.filter(({ key }) => key !== row.key))}
                        >
                          Remove module
                        </Button>
                      </div>
                    </fieldset>
                  ))}
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={rows.length >= 500}
                    onClick={() =>
                      changeRows([
                        ...rows,
                        {
                          key: nextKey.current++,
                          studyYear,
                          semester,
                          code: '',
                          name: '',
                          theoryHours: 0,
                          labHours: 0,
                          nameAr: null,
                          credits: null,
                          theoryMarks: null,
                          practicalMarks: null,
                          totalMarks: null,
                          progressMarks: null,
                          requirement: 'required',
                        },
                      ])
                    }
                  >
                    Add module
                  </Button>
                </div>
              </fieldset>
            ))}
          </section>
        ))}
        {emptyCount > 0 && (
          <label>
            <input
              type="checkbox"
              checked={allowEmptySemesters}
              onChange={(event) => setAllowEmptySemesters(event.target.checked)}
            />
            Publish with {emptyCount} empty {emptyCount === 1 ? 'semester' : 'semesters'}
          </label>
        )}
        <div className="sta-actions">
          <Button disabled={!dirty}>Save draft</Button>
          <Button
            type="button"
            variant="outline"
            disabled={dirty || !rows.length || (emptyCount > 0 && !allowEmptySemesters)}
            onClick={() =>
              publish.mutate({
                path: `/curricula/${plan.id}/publish`,
                body: { expectedRevision: plan.revision, allowEmptySemesters },
              })
            }
          >
            Publish version
          </Button>
        </div>
      </fieldset>
      <DepartmentError error={save.error || publish.error} />
    </form>
  );
}
