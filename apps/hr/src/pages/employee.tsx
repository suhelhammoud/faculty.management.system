import { formatDate } from '@project/ui/date-input';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { hrApi } from '../lib/api';
import {
  personalValues,
  personalPayload,
  requiredPersonal,
  validateValues,
  serverFieldErrors,
} from '../lib/forms';
import {
  personalFields,
  employeeName,
  referenceName,
  referenceId,
  type Employee,
  type Employment,
  type Kind,
} from '../lib/types';
import { useReferences } from '../lib/queries';
import { useUi } from '../lib/store';
import { Field, ErrorMessage, Loading, Success, ReferenceSelect } from '../components/common';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';

export function EmployeePage({ edit = false }: { edit?: boolean }) {
  const { employeeId } = useParams();
  const { t } = useTranslation();
  const language = useUi((s) => s.language);
  const employee = useQuery({
    queryKey: ['hr', 'employee', employeeId],
    queryFn: ({ signal }) => hrApi<Employee>(`employees/${employeeId}`, 'GET', undefined, signal),
    enabled: !!employeeId,
  });
  if (!employeeId) return <PersonalForm />;
  if (employee.isPending) return <Loading />;
  if (employee.error)
    return <ErrorMessage error={employee.error} retry={() => void employee.refetch()} />;
  const data = employee.data;
  return (
    <div className="hr-stack">
      <Link to="/hr/employees">{t('Back to employees')}</Link>
      <div className="hr-row">
        <div className="hr-person-heading">
          <img
            className="hr-portrait"
            src={new URL('../../public/images/employee-placeholder.svg', import.meta.url).href}
            alt=""
            width="72"
            height="72"
          />
          <div>
            <h2 dir="auto">{employeeName(data, language)}</h2>
            <p className="hr-muted" dir="ltr">
              {data.employeeNumber}
            </p>
          </div>
        </div>
        {!edit && (
          <Button asChild>
            <Link to={`/hr/employees/${employeeId}/edit`}>{t('Edit employee')}</Link>
          </Button>
        )}
      </div>
      {edit ? (
        <>
          <p className="hr-muted">
            {t('Personal information and employment are saved separately.')}
          </p>
          <PersonalForm key={employeeId} employee={data} />
          <EmploymentForm
            key={`employment-${employeeId}`}
            employeeId={employeeId}
            employment={data.employment}
          />
        </>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('Personal information')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="hr-detail-grid">
                {personalFields.map((field) => (
                  <div key={field}>
                    <dt>{t(field)}</dt>
                    <dd dir="auto">
                      {(field === 'birthDate' && data[field]
                        ? formatDate(data[field])
                        : data[field]) || '—'}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          <EmploymentDetails employment={data.employment} />
        </>
      )}
    </div>
  );
}
function PersonalForm({ employee }: { employee?: Employee }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [values, setValues] = useState(() => personalValues(employee));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () =>
      hrApi<Employee>(
        employee ? `employees/${employee.employeeId}` : 'employees',
        employee ? 'PATCH' : 'POST',
        personalPayload(values),
      ),
    onError: (error) => setErrors(serverFieldErrors(error, personalFields)),
    onSuccess: async (saved) => {
      await client.invalidateQueries({ queryKey: ['hr', 'employees'] });
      if (employee) {
        await client.invalidateQueries({ queryKey: ['hr', 'employee', employee.employeeId] });
      } else navigate(`/hr/employees/${saved.employeeId}`);
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(employee ? 'Personal information' : 'New employee')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="hr-stack"
          onSubmit={(event) => {
            event.preventDefault();
            const nextErrors = validateValues(values, requiredPersonal);
            setErrors(nextErrors);
            if (!Object.keys(nextErrors).length) save.mutate();
          }}
          noValidate
        >
          <fieldset disabled={save.isPending}>
            <div className="hr-form-fields">
              {personalFields.map((name) => (
                <Field
                  key={name}
                  name={name}
                  value={values[name]}
                  onChange={(value) => {
                    setValues((v) => ({ ...v, [name]: value }));
                    setErrors((v) => ({ ...v, [name]: '' }));
                    save.reset();
                  }}
                  error={errors[name]}
                  required={requiredPersonal.includes(name)}
                  textarea={['address', 'notes'].includes(name)}
                  type={
                    name === 'birthDate'
                      ? 'date'
                      : name === 'email'
                        ? 'email'
                        : /Phone$|Number$/.test(name) &&
                            name !== 'employeeNumber' &&
                            name !== 'civilRegistryNumber'
                          ? 'tel'
                          : 'text'
                  }
                />
              ))}
            </div>
          </fieldset>
          <ErrorMessage error={save.error} />
          <Success show={save.isSuccess} />
          <div className="hr-actions">
            <Button disabled={save.isPending}>
              {t(
                save.isPending
                  ? 'Saving…'
                  : employee
                    ? 'Save personal information'
                    : 'Create employee',
              )}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to={employee ? `/hr/employees/${employee.employeeId}` : '/hr/employees'}>
                {t('Cancel')}
              </Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
function EmploymentDetails({ employment }: { employment: Employment | null }) {
  const { t } = useTranslation();
  const language = useUi((s) => s.language);
  const categories = useReferences('staff-categories');
  const positions = useReferences('positions');
  const ranks = useReferences('academic-ranks');
  const grades = useReferences('employment-grades');
  const getName = (kind: Kind, id: string | null, rows = [] as typeof categories.data) => {
    const row = rows?.find((r) => referenceId(kind, r) === id);
    return row ? referenceName(row, language) : '—';
  };
  const refs = {
    categoryId: getName('staff-categories', employment?.categoryId || null, categories.data),
    positionId: getName('positions', employment?.positionId || null, positions.data),
    academicRankId: getName('academic-ranks', employment?.academicRankId || null, ranks.data),
    gradeId: getName('employment-grades', employment?.gradeId || null, grades.data),
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Current employment')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ErrorMessage error={categories.error || positions.error || ranks.error || grades.error} />
        {!employment ? (
          <p>{t('No employment information yet.')}</p>
        ) : (
          <dl className="hr-detail-grid">
            {Object.entries({
              ...refs,
              department: employment.department,
              employmentRegime: employment.employmentRegime,
              employmentStatus: employment.employmentStatus,
              startDate: formatDate(employment.startDate),
              endDate: employment.endDate ? formatDate(employment.endDate) : null,
              notes: employment.notes,
            }).map(([key, value]) => (
              <div key={key}>
                <dt>{t(key)}</dt>
                <dd dir="auto">{value ? t(value) : '—'}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
function EmploymentForm({
  employeeId,
  employment,
}: {
  employeeId: string;
  employment: Employment | null;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const categories = useReferences('staff-categories');
  const positions = useReferences('positions');
  const ranks = useReferences('academic-ranks');
  const grades = useReferences('employment-grades');
  const schemes = useReferences('grade-schemes');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [
        'categoryId',
        'positionId',
        'academicRankId',
        'gradeId',
        'department',
        'employmentRegime',
        'employmentStatus',
        'startDate',
        'endDate',
        'notes',
      ].map((key) => [
        key,
        employment?.[key as keyof Employment] || (key === 'employmentStatus' ? 'active' : ''),
      ]),
    ),
  );
  const [scheme, setScheme] = useState<string | null>(null);
  const selectedScheme =
    scheme ?? grades.data?.find((r) => r.gradeId === values.gradeId)?.schemeId ?? '';
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (name: string) => (value: string) => {
    setValues((v) => ({
      ...v,
      [name]: value,
      ...(name === 'categoryId' ? { positionId: '' } : {}),
    }));
    setErrors((e) => ({ ...e, [name]: '' }));
    save.reset();
  };
  const save = useMutation({
    mutationFn: () =>
      hrApi(
        `employees/${employeeId}/employment`,
        'PUT',
        Object.fromEntries(
          Object.entries(values).map(([key, value]) => [key, value.trim() || null]),
        ),
      ),
    onError: (error) => setErrors(serverFieldErrors(error, Object.keys(values))),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['hr', 'employee', employeeId] }),
        client.invalidateQueries({ queryKey: ['hr', 'employees'] }),
      ]);
    },
  });
  const loading =
    categories.isPending ||
    positions.isPending ||
    ranks.isPending ||
    grades.isPending ||
    schemes.isPending;
  const error = categories.error || positions.error || ranks.error || grades.error || schemes.error;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Current employment')}</CardTitle>
      </CardHeader>
      <CardContent className="hr-stack">
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorMessage
            error={error}
            retry={() => {
              void categories.refetch();
              void positions.refetch();
              void ranks.refetch();
              void grades.refetch();
              void schemes.refetch();
            }}
          />
        ) : (
          <>
            {(!categories.data?.length || !positions.data?.length) && (
              <p>
                <Link to="/hr/settings/staff-categories">
                  {t('Create reference data in Settings first.')}
                </Link>
              </p>
            )}
            <form
              className="hr-stack"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                const nextErrors = validateValues(values, [
                  'categoryId',
                  'positionId',
                  'employmentRegime',
                  'employmentStatus',
                  'startDate',
                ]);
                setErrors(nextErrors);
                if (!Object.keys(nextErrors).length) save.mutate();
              }}
            >
              <fieldset disabled={save.isPending}>
                <div className="hr-form-fields">
                  <ReferenceSelect
                    kind="staff-categories"
                    name="categoryId"
                    rows={categories.data}
                    value={values.categoryId}
                    onChange={set('categoryId')}
                    required
                    error={errors.categoryId}
                  />
                  <ReferenceSelect
                    kind="positions"
                    name="positionId"
                    rows={positions.data?.filter((p) => p.categoryId === values.categoryId)}
                    value={values.positionId}
                    onChange={set('positionId')}
                    required
                    error={errors.positionId}
                  />
                  <ReferenceSelect
                    kind="academic-ranks"
                    name="academicRankId"
                    rows={ranks.data}
                    value={values.academicRankId}
                    onChange={set('academicRankId')}
                    placeholder="None"
                  />
                  <ReferenceSelect
                    kind="grade-schemes"
                    name="schemeId"
                    rows={schemes.data}
                    value={selectedScheme}
                    onChange={(id) => {
                      setScheme(id);
                      set('gradeId')('');
                    }}
                    placeholder="None"
                  />
                  <ReferenceSelect
                    kind="employment-grades"
                    name="gradeId"
                    rows={grades.data?.filter((g) => g.schemeId === selectedScheme)}
                    value={values.gradeId}
                    onChange={set('gradeId')}
                    placeholder="None"
                  />
                  {[
                    'department',
                    'employmentRegime',
                    'employmentStatus',
                    'startDate',
                    'endDate',
                    'notes',
                  ].map((name) => (
                    <Field
                      key={name}
                      name={name}
                      value={values[name]}
                      onChange={set(name)}
                      required={['employmentRegime', 'employmentStatus', 'startDate'].includes(
                        name,
                      )}
                      error={errors[name]}
                      type={name.endsWith('Date') ? 'date' : 'text'}
                      textarea={name === 'notes'}
                    />
                  ))}
                </div>
              </fieldset>
              <ErrorMessage error={save.error} />
              <Success show={save.isSuccess} />
              <Button disabled={save.isPending}>
                {t(save.isPending ? 'Saving…' : 'Save employment information')}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
