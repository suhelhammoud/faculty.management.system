import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { hrApi } from '../lib/api';
import { useReferences } from '../lib/queries';
import { useUi } from '../lib/store';
import { employeeFilters } from '../lib/forms';
import {
  employeeName,
  referenceId,
  referenceName,
  type EmployeePage,
  type Kind,
} from '../lib/types';
import { Field, ReferenceSelect, Loading, ErrorMessage, SelectField } from '../components/common';
import { Button } from '../components/ui/button';
import { NativeSelectOption } from '../components/ui/native-select';
import { Card, CardContent } from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

export function EmployeesPage() {
  const [params, setParams] = useSearchParams();
  return <EmployeeList key={params.toString()} params={params} setParams={setParams} />;
}
function EmployeeList({
  params,
  setParams,
}: {
  params: URLSearchParams;
  setParams: (params: URLSearchParams) => void;
}) {
  const { t } = useTranslation();
  const language = useUi((s) => s.language);
  const filters = employeeFilters(params);
  const [draft, setDraft] = useState(Object.fromEntries(filters));
  const category = useReferences('staff-categories');
  const positions = useReferences('positions');
  const query = useQuery({
    queryKey: ['hr', 'employees', filters.toString()],
    queryFn: ({ signal }) => hrApi<EmployeePage>(`employees?${filters}`, 'GET', undefined, signal),
  });
  const set = (key: string) => (value: string) =>
    setDraft((old) => ({
      ...old,
      [key]: value,
      ...(key === 'categoryId' ? { positionId: '' } : {}),
    }));
  const label = (kind: Kind, id?: string) => {
    const row = (kind === 'positions' ? positions.data : category.data)?.find(
      (row) => referenceId(kind, row) === id,
    );
    return row ? referenceName(row, language) : '—';
  };
  const page = Number(filters.get('page'));
  const pageSize = Number(filters.get('pageSize'));
  const pages = Math.max(1, Math.ceil((query.data?.total || 0) / pageSize));
  const turnPage = (next: number) => {
    const nextParams = new URLSearchParams(filters);
    nextParams.set('page', String(next));
    setParams(nextParams);
  };
  return (
    <div className="hr-stack">
      <div className="hr-row">
        <div>
          <h2>{t('Employees')}</h2>
          <p className="hr-muted">{t('Employee records')}</p>
        </div>
        <Button asChild>
          <Link to="/hr/employees/new">{t('New employee')}</Link>
        </Button>
      </div>
      <Card>
        <CardContent>
          <form
            className="hr-stack"
            onSubmit={(event) => {
              event.preventDefault();
              const next = new URLSearchParams();
              for (const [key, value] of Object.entries(draft))
                if (value.trim()) next.set(key, value.trim());
              next.set('page', '1');
              setParams(employeeFilters(next));
            }}
          >
            <div className="hr-form-fields">
              <Field name="Search" value={draft.search || ''} onChange={set('search')} />
              <ReferenceSelect
                name="categoryId"
                kind="staff-categories"
                rows={category.data}
                value={draft.categoryId || ''}
                onChange={set('categoryId')}
                placeholder="All categories"
              />
              <ReferenceSelect
                name="positionId"
                kind="positions"
                rows={positions.data?.filter(
                  (p) => !draft.categoryId || p.categoryId === draft.categoryId,
                )}
                value={draft.positionId || ''}
                onChange={set('positionId')}
                placeholder="All positions"
              />
              <Field
                name="employmentStatus"
                value={draft.employmentStatus || ''}
                onChange={set('employmentStatus')}
              />
              <SelectField
                name="Rows per page"
                value={draft.pageSize || '20'}
                onChange={set('pageSize')}
              >
                {[10, 20, 50, 100].map((size) => (
                  <NativeSelectOption key={size} value={size}>
                    {size}
                  </NativeSelectOption>
                ))}
              </SelectField>
            </div>
            <div className="hr-actions">
              <Button type="submit">{t('Apply filters')}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setParams(new URLSearchParams())}
              >
                {t('Clear filters')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <ErrorMessage
        error={category.error || positions.error}
        retry={() => {
          void category.refetch();
          void positions.refetch();
        }}
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorMessage error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data && (
          <>
            {!query.data.records.length ? (
              <Card>
                <CardContent className="hr-stack">
                  <h3>{t('No employees found.')}</h3>
                  <p>{t('Create your first employee record or adjust the filters.')}</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {[
                          'employeeNumber',
                          'Name',
                          'categoryId',
                          'positionId',
                          'department',
                          'employmentStatus',
                          'Actions',
                        ].map((key) => (
                          <TableHead key={key}>{t(key)}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {query.data.records.map((employee) => (
                        <TableRow key={employee.employeeId}>
                          <TableCell dir="ltr">{employee.employeeNumber}</TableCell>
                          <TableCell dir="auto">
                            <Link to={`/hr/employees/${employee.employeeId}`}>
                              {employeeName(employee, language)}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {label('staff-categories', employee.employment?.categoryId)}
                          </TableCell>
                          <TableCell>
                            {label('positions', employee.employment?.positionId)}
                          </TableCell>
                          <TableCell dir="auto">{employee.employment?.department || '—'}</TableCell>
                          <TableCell>
                            {employee.employment?.employmentStatus
                              ? t(employee.employment.employmentStatus)
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Link to={`/hr/employees/${employee.employeeId}/edit`}>
                              {t('Edit')}
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
            <div className="hr-row">
              <p>
                {t('Results')}: {query.data.total} · {t('Page')} {page} {t('of')} {pages}
              </p>
              <div className="hr-actions">
                <Button variant="outline" disabled={page <= 1} onClick={() => turnPage(page - 1)}>
                  {t('Previous')}
                </Button>
                <Button
                  variant="outline"
                  disabled={page >= pages}
                  onClick={() => turnPage(page + 1)}
                >
                  {t('Next')}
                </Button>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
