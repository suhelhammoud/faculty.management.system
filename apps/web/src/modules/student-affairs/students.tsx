import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router';
import { DateInput, formatDate, parseDate } from '@/components/ui/date-input';
import type {
  PromotionGrant,
  StudentAffairsCapabilities as Access,
  StudentAnnualRecord,
  StudentList,
  StudentProfile,
} from '@project/contracts/student-affairs';
import { ApiError, root, useRead, useWrite } from './api';
import {
  ActionLink,
  Button,
  canWriteYear,
  ErrorMessage,
  Field,
  grantState,
  Input,
  Resource,
  studentName,
  useGrantClock,
  YearOptions,
  years,
} from './common';
import { useLanguage, type Label } from './language';

const registry = `${root}/students`;
const profilePath = (id: string) => `students/${encodeURIComponent(id)}`;
const studentUrl = (id: string) => `${root}/${profilePath(id)}`;
type ProfileKey = Exclude<
  keyof StudentProfile,
  'studentId' | 'currentStudyYear' | 'createdAt' | 'updatedAt' | 'revision'
>;
type CoreKey = 'academicId' | 'firstName' | 'fatherName' | 'lastName';
type ProfileField = [
  key: ProfileKey,
  label: Label,
  kind?: 'email' | 'tel' | 'date' | 'decimal' | 'textarea',
];
const identityKeys: CoreKey[] = ['academicId', 'firstName', 'fatherName', 'lastName'];
const groups: { title: Label; fields: ProfileField[] }[] = [
  {
    title: 'Student identity',
    fields: [
      ['academicId', 'Academic ID'],
      ['firstName', 'First name'],
      ['fatherName', 'Father’s name'],
      ['lastName', 'Last name'],
      ['motherName', 'Mother’s name'],
      ['birthDate', 'Birth date', 'date'],
      ['birthPlace', 'Birth place'],
      ['nationality', 'Nationality'],
      ['gender', 'Gender'],
      ['governorate', 'Governorate'],
      ['civilRegistryPlace', 'Civil registry place'],
      ['civilRegistryNumber', 'Civil registry number'],
    ],
  },
  {
    title: 'Contact details',
    fields: [
      ['mobileNumber', 'Mobile', 'tel'],
      ['phoneNumber', 'Phone', 'tel'],
      ['email', 'Email', 'email'],
      ['permanentAddress', 'Permanent address'],
      ['homsAddress', 'Homs address'],
    ],
  },
  {
    title: 'Admission details',
    fields: [
      ['enrollmentDate', 'Enrollment date', 'date'],
      ['secondaryCertificate', 'Secondary certificate'],
      ['certificateType', 'Certificate type'],
      ['certificateDate', 'Certificate date', 'date'],
      ['gradeAverage', 'Grade average', 'decimal'],
      ['totalScore', 'Total score', 'decimal'],
      ['adjustedScore', 'Adjusted score', 'decimal'],
      ['equivalencyDecision', 'Equivalency decision'],
      ['language', 'Language'],
      ['examRegistrationNumber', 'Exam registration number'],
    ],
  },
  { title: 'Administrative notes', fields: [['notes', 'Notes', 'textarea']] },
];

export function Registry({ access }: { access: Access }) {
  const { t, year } = useLanguage();
  const [params, setParams] = useSearchParams();
  const search = (params.get('search') ?? '').trim().slice(0, 200);
  const rawYear = params.get('studyYear') ?? '';
  const filter = /^[1-5]$|^unassigned$/.test(rawYear) ? rawYear : '';
  const rawPage = Number(params.get('page'));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 1_000_000) : 1;
  const query = new URLSearchParams({ page: String(page) });
  if (search) query.set('search', search);
  if (filter) query.set('studyYear', filter);
  const result = useRead<StudentList>(`students?${query}`);
  const setFilters = (text: string, studyYear: string, nextPage = 1) => {
    const next = new URLSearchParams();
    if (text.trim()) next.set('search', text.trim());
    if (studyYear) next.set('studyYear', studyYear);
    if (nextPage > 1) next.set('page', String(nextPage));
    setParams(next);
  };
  return (
    <section className="sta-stack">
      <div className="sta-heading">
        <h2>{t('Students')}</h2>
        {(access.administer || access.assignedStudyYears.length > 0) && (
          <ActionLink primary to={`${registry}/new`}>
            {t('New student')}
          </ActionLink>
        )}
      </div>
      <form
        key={`${search}\0${filter}`}
        className="sta-panel sta-actions sta-filters"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setFilters(String(data.get('search')), String(data.get('studyYear')));
        }}
      >
        <Field label={t('Search by name or academic ID')}>
          <Input name="search" type="search" maxLength={200} defaultValue={search} />
        </Field>
        <Field label={t('Study year')}>
          <select name="studyYear" data-slot="native-select" defaultValue={filter}>
            <option value="">{t('All study years')}</option>
            <YearOptions />
            <option value="unassigned">{t('Unassigned')}</option>
          </select>
        </Field>
        <Button>{t('Search')}</Button>
      </form>
      <Resource query={result}>
        {({ records, total, pageSize }) => (
          <>
            {records.length === 0 ? (
              <p>{t('No students match these filters.')}</p>
            ) : (
              <div className="sta-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t('Student name')}</th>
                      <th>{t('Academic ID')}</th>
                      <th>{t('Current study year')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((student) => (
                      <tr key={student.studentId}>
                        <td>
                          <NavLink to={studentUrl(student.studentId)}>
                            <bdi>{studentName(student)}</bdi>
                          </NavLink>
                        </td>
                        <td>
                          <bdi>{student.academicId}</bdi>
                        </td>
                        <td>{year(student.currentStudyYear)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(page > 1 || total > pageSize) && (
              <div className="sta-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setFilters(search, filter, page - 1)}
                >
                  {t('Previous page')}
                </Button>
                <span aria-live="polite">
                  {t('Page')} {page}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={page * pageSize >= total}
                  onClick={() => setFilters(search, filter, page + 1)}
                >
                  {t('Next page')}
                </Button>
              </div>
            )}
          </>
        )}
      </Resource>
    </section>
  );
}

function DateField({ name, initial }: { name: string; initial?: string | null }) {
  const { language } = useLanguage();
  const [value, setValue] = useState(initial ?? '');
  return (
    <DateInput
      language={language}
      name={name}
      value={value}
      onValueChange={setValue}
      data-slot="input"
    />
  );
}

function ProfileForm({
  access,
  student,
  reload,
}: {
  access: Access;
  student?: StudentProfile;
  reload?: () => Promise<void>;
}) {
  const [baseline] = useState(student);
  const [reloading, setReloading] = useState(false);
  const { t } = useLanguage();
  const navigate = useNavigate();
  const write = useWrite<StudentProfile>();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = new FormData(event.currentTarget);
    const body: Record<string, string | number | null> = {};
    for (const { fields } of groups)
      for (const [key, , kind] of fields) {
        if (key === 'adjustedScore') continue;
        const text = String(input.get(key) ?? '').trim();
        const value = kind === 'date' ? parseDate(text) : text || null;
        if (value !== (baseline?.[key] ?? null)) body[key] = value;
      }
    if (!student) body.currentStudyYear = Number(input.get('currentStudyYear'));
    if (student && Object.keys(body).length === 0) {
      void navigate(studentUrl(student.studentId));
      return;
    }
    if (baseline) body.expectedRevision = baseline.revision;
    write.mutate(
      {
        path: student ? profilePath(student.studentId) : 'students',
        method: student ? 'PATCH' : 'POST',
        body,
      },
      { onSuccess: (saved) => void navigate(studentUrl(saved.studentId)) },
    );
  }
  const conflict =
    write.error instanceof ApiError && write.error.code === 'STUDENT_REVISION_CONFLICT';
  return (
    <form className="sta-stack" onSubmit={submit}>
      <fieldset className="sta-form-sections" disabled={write.isPending}>
        {!student && (
          <div className="sta-panel">
            <Field label={t('Current study year')}>
              <select name="currentStudyYear" data-slot="native-select" required defaultValue="">
                <option value="">{t('Choose a year')}</option>
                <YearOptions choices={access.administer ? years : access.assignedStudyYears} />
              </select>
            </Field>
          </div>
        )}
        {groups.map(({ title, fields }) => (
          <section className="sta-panel" key={title}>
            <h3>{t(title)}</h3>
            <div className="sta-fields">
              {fields.map(([key, label, kind]) => {
                if (key === 'adjustedScore') return null;
                const required =
                  identityKeys.some((identity) => identity === key) &&
                  (!student || Boolean(baseline?.[key]));
                return (
                  <Field label={t(label)} key={key}>
                    {kind === 'textarea' ? (
                      <textarea
                        name={key}
                        maxLength={10000}
                        data-slot="textarea"
                        defaultValue={baseline?.[key] ?? ''}
                      />
                    ) : kind === 'date' ? (
                      <DateField name={key} initial={baseline?.[key]} />
                    ) : (
                      <Input
                        name={key}
                        type={kind === 'email' || kind === 'tel' ? kind : 'text'}
                        inputMode={kind === 'decimal' ? 'decimal' : undefined}
                        maxLength={1000}
                        required={required}
                        dir={
                          kind === 'decimal' ||
                          kind === 'tel' ||
                          kind === 'email' ||
                          key === 'academicId'
                            ? 'ltr'
                            : 'auto'
                        }
                        defaultValue={baseline?.[key] ?? ''}
                      />
                    )}
                  </Field>
                );
              })}
            </div>
          </section>
        ))}
      </fieldset>
      <ErrorMessage error={write.error} />
      <div className="sta-actions">
        <Button disabled={write.isPending || conflict}>{t('Save')}</Button>
        {conflict && reload && (
          <Button
            type="button"
            variant="outline"
            disabled={reloading}
            onClick={async () => {
              if (!window.confirm(t('Discard your unsaved edits and reload the latest record?')))
                return;
              setReloading(true);
              try {
                await reload();
              } finally {
                setReloading(false);
              }
            }}
          >
            {t('Reload latest record')}
          </Button>
        )}
        <ActionLink to={student ? studentUrl(student.studentId) : registry}>
          {t('Cancel')}
        </ActionLink>
      </div>
    </form>
  );
}

export function NewStudent({ access }: { access: Access }) {
  const { t } = useLanguage();
  return (
    <section className="sta-stack">
      <div className="sta-heading">
        <h2>{t('New student')}</h2>
        <ActionLink to={registry}>{t('Back to students')}</ActionLink>
      </div>
      <ProfileForm access={access} />
    </section>
  );
}

export function StudentRoute({
  access,
  view,
}: {
  access: Access;
  view: 'profile' | 'edit' | 'annual';
}) {
  const { studentId = '' } = useParams();
  const query = useRead<StudentProfile>(profilePath(studentId));
  const [draftGeneration, newDraft] = useState(0);
  const { t, year } = useLanguage();
  return (
    <Resource query={query}>
      {(student) => (
        <section key={student.studentId} className="sta-stack">
          <div className="sta-heading">
            <div>
              <h2>
                <bdi>{studentName(student)}</bdi>
              </h2>
              <p className="sta-muted">
                <bdi>{student.academicId}</bdi> · {year(student.currentStudyYear)}
              </p>
            </div>
            <ActionLink to={registry}>{t('Back to students')}</ActionLink>
          </div>
          <nav aria-label={t('Profile')} className="module-navigation">
            <NavLink end to={studentUrl(student.studentId)}>
              {t('Profile')}
            </NavLink>
            <NavLink to={`${studentUrl(student.studentId)}/academic-years`}>
              {t('Annual records')}
            </NavLink>
          </nav>
          {view === 'edit' ? (
            canWriteYear(access, student.currentStudyYear) ? (
              <>
                <h3>{t('Edit profile')}</h3>
                <ProfileForm
                  key={`edit-${student.studentId}-${draftGeneration}`}
                  student={student}
                  access={access}
                  reload={async () => {
                    const result = await query.refetch();
                    if (result.isSuccess) newDraft((generation) => generation + 1);
                  }}
                />
              </>
            ) : (
              <p role="alert">{t('Access denied')}</p>
            )
          ) : view === 'annual' ? (
            <AnnualRecords student={student} access={access} />
          ) : (
            <>
              {canWriteYear(access, student.currentStudyYear) && (
                <div className="sta-actions">
                  <ActionLink primary to={`${studentUrl(student.studentId)}/edit`}>
                    {t('Edit profile')}
                  </ActionLink>
                </div>
              )}
              {access.administer && (
                <YearChange
                  key={student.studentId}
                  student={student}
                  refreshStudent={query.refetch}
                />
              )}
              {groups.map(({ title, fields }) => (
                <section className="sta-panel" key={title}>
                  <h3>{t(title)}</h3>
                  <dl className="sta-fields">
                    {fields.map(([key, label, kind]) => (
                      <div key={key}>
                        <dt>{t(label)}</dt>
                        <dd>
                          <bdi>
                            {student[key]
                              ? kind === 'date'
                                ? formatDate(student[key])
                                : student[key]
                              : '—'}
                          </bdi>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </>
          )}
        </section>
      )}
    </Resource>
  );
}

function YearChange({
  student,
  refreshStudent,
}: {
  student: StudentProfile;
  refreshStudent: () => Promise<unknown>;
}) {
  const { t, year, dateTime } = useLanguage();
  const query = useRead<{ grant: PromotionGrant | null }>('promotion-grants/current', 30_000);
  const { refetch } = query;
  const grant = query.data?.grant;
  const now = useGrantClock(grant?.expiresAt);
  const expired = !!grant && grantState(grant, now) === 'Expired';
  useEffect(() => {
    if (expired) void refetch();
  }, [expired, refetch, grant?.id]);
  const [destination, setDestination] = useState('');
  const [confirming, setConfirming] = useState<{
    revision: number;
    source: number | null;
    destination: number;
  } | null>(null);
  const write = useWrite<StudentProfile>();
  const active = !!grant && !query.isError && !expired && !grant.revokedAt;
  const canMove = student.currentStudyYear === null || active;
  const heading = student.currentStudyYear === null ? 'Assign study year' : 'Change study year';

  return (
    <section className="sta-panel sta-stack">
      <div className="sta-heading">
        <h3>{t(heading)}</h3>
        <Button
          type="button"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void refetch()}
        >
          {t('Refresh grant status')}
        </Button>
      </div>
      {student.currentStudyYear !== null &&
        (query.isPending ? (
          <p role="status">{t('Loading…')}</p>
        ) : query.isError ? (
          <ErrorMessage error={query.error} />
        ) : (
          <p>
            {active ? (
              <>
                {t('Grant expires')} <bdi>{dateTime(grant.expiresAt)}</bdi>
              </>
            ) : (
              t('No active dean grant.')
            )}
          </p>
        ))}
      {canMove && (
        <form
          className="sta-stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (!confirming)
              return setConfirming({
                revision: student.revision,
                source: student.currentStudyYear,
                destination: Number(destination),
              });
            write.mutate(
              {
                path: `${profilePath(student.studentId)}/current-study-year`,
                method: 'PUT',
                body: {
                  currentStudyYear: confirming.destination,
                  expectedRevision: confirming.revision,
                },
              },
              {
                onSuccess: () => {
                  setConfirming(null);
                  setDestination('');
                },
                onError: () => {
                  void refreshStudent();
                  setConfirming(null);
                  void refetch();
                },
              },
            );
          }}
        >
          <div className="sta-actions sta-filters">
            <Field label={t('Destination year')}>
              <select
                data-slot="native-select"
                value={destination}
                required
                disabled={Boolean(confirming) || write.isPending}
                onChange={(event) => setDestination(event.target.value)}
              >
                <option value="">{t('Choose a year')}</option>
                <YearOptions
                  choices={years.filter((value) => value !== student.currentStudyYear)}
                />
              </select>
            </Field>
            <Button
              disabled={
                write.isPending || !destination || Number(destination) === student.currentStudyYear
              }
            >
              {t(confirming ? 'Confirm year change' : heading)}
            </Button>
            {confirming && (
              <Button
                type="button"
                variant="outline"
                disabled={write.isPending}
                onClick={() => setConfirming(null)}
              >
                {t('Cancel')}
              </Button>
            )}
          </div>
          {confirming && (
            <p role="status">
              {t('Previous study year')} {year(confirming.source)} · {t('Destination year')}{' '}
              {year(confirming.destination)}
            </p>
          )}
        </form>
      )}
      <ErrorMessage error={write.error} />
      {write.isSuccess && <p role="status">{t('Study year updated.')}</p>}
    </section>
  );
}

function AnnualRecords({ student, access }: { student: StudentProfile; access: Access }) {
  const { t, year } = useLanguage();
  const path = `${profilePath(student.studentId)}/academic-years`;
  const query = useRead<StudentAnnualRecord[]>(path);
  const [editing, setEditing] = useState<'new' | StudentAnnualRecord>();
  const selected = editing === 'new' ? undefined : editing;
  const allowed = selected
    ? canWriteYear(access, selected.year)
    : canWriteYear(access, student.currentStudyYear);
  return (
    <section className="sta-stack">
      <div className="sta-heading">
        <h3>{t('Annual records')}</h3>
        {canWriteYear(access, student.currentStudyYear) && (
          <Button type="button" onClick={() => setEditing('new')}>
            {t('Add annual record')}
          </Button>
        )}
      </div>
      {editing && allowed && (
        <AnnualForm
          key={editing === 'new' ? 'new' : editing.academicYear}
          path={path}
          student={student}
          record={selected}
          admin={access.administer}
          close={() => setEditing(undefined)}
        />
      )}
      <Resource query={query}>
        {(records) =>
          records.length === 0 ? (
            <p>{t('No annual records yet.')}</p>
          ) : (
            <div className="sta-table">
              <table>
                <thead>
                  <tr>
                    <th>{t('Academic period')}</th>
                    <th>{t('Study year')}</th>
                    <th>{t('Remarks')}</th>
                    <th aria-label={t('Edit annual record')} />
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.academicYear}>
                      <td>
                        <bdi>{record.academicYear}</bdi>
                      </td>
                      <td>{year(record.year)}</td>
                      <td>
                        <bdi>{record.remarks || '—'}</bdi>
                      </td>
                      <td>
                        {canWriteYear(access, record.year) && (
                          <Button
                            type="button"
                            variant="outline"
                            aria-label={`${t('Edit annual record')} ${record.academicYear}`}
                            onClick={() => setEditing(record)}
                          >
                            {t('Edit annual record')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Resource>
    </section>
  );
}

function AnnualForm({
  path,
  student,
  record,
  admin,
  close,
}: {
  path: string;
  student: StudentProfile;
  record?: StudentAnnualRecord;
  admin: boolean;
  close: () => void;
}) {
  const { t, year } = useLanguage();
  const write = useWrite<StudentAnnualRecord>();
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      className="sta-panel sta-stack"
      onSubmit={(event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const period = String(values.get('academicYear') ?? '').trim();
        if (
          !record &&
          (!/^[1-9]\d{3}-\d{4}$/.test(period) ||
            Number(period.slice(0, 4)) + 1 !== Number(period.slice(5)))
        ) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        const remarks = String(values.get('remarks') ?? '').trim() || null;
        const selectedYear = admin ? Number(values.get('year')) : student.currentStudyYear;
        write.mutate(
          record
            ? {
                path: `${path}/${encodeURIComponent(record.academicYear)}`,
                method: 'PATCH',
                body: {
                  remarks,
                  ...(admin && record.year !== selectedYear ? { year: selectedYear } : {}),
                },
              }
            : { path, method: 'POST', body: { remarks, academicYear: period, year: selectedYear } },
          { onSuccess: close },
        );
      }}
    >
      <h3>
        {t(record ? 'Edit annual record' : 'Add annual record')}{' '}
        {record && <bdi>{record.academicYear}</bdi>}
      </h3>
      {!record && (
        <Field label={t('Academic period')}>
          <Input name="academicYear" dir="ltr" placeholder="YYYY-YYYY" maxLength={9} required />
        </Field>
      )}
      {admin ? (
        <Field label={t('Study year')}>
          <select
            data-slot="native-select"
            name="year"
            defaultValue={record?.year ?? student.currentStudyYear ?? ''}
            required
          >
            <option value="">{t('Choose a year')}</option>
            <YearOptions />
          </select>
        </Field>
      ) : (
        <p>
          {t('Study year')} {year(record?.year ?? student.currentStudyYear)}
        </p>
      )}
      <Field label={t('Remarks')}>
        <textarea
          data-slot="textarea"
          name="remarks"
          maxLength={10000}
          defaultValue={record?.remarks ?? ''}
        />
      </Field>
      {invalid && <p role="alert">{t('Use consecutive years in YYYY-YYYY format.')}</p>}
      <ErrorMessage error={write.error} />
      <div className="sta-actions">
        <Button disabled={write.isPending}>{t('Save')}</Button>
        <Button type="button" variant="outline" disabled={write.isPending} onClick={close}>
          {t('Cancel')}
        </Button>
      </div>
    </form>
  );
}
