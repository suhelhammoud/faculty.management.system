import type { FormEvent } from 'react';
import { Link, Route, Routes, useNavigate, useSearchParams } from 'react-router';
import type { CurriculumVersion, Department } from '@project/contracts/department';
import type { StudentAffairsCapabilities } from '@project/contracts/student-affairs';
import { StudentAffairsSession } from '../student-affairs/App';
import { useRead } from '../student-affairs/api';
import { Button, Field, Input, Resource } from '../student-affairs/common';
import { useDepartmentRead, useDepartmentWrite } from './api';
import { Assignments } from './assignments';
import { CurriculumRoute, DepartmentError, versionLabel } from './curricula';

function DepartmentForm({
  department,
  onSave,
}: {
  department?: Department;
  onSave?: (id: string) => void;
}) {
  const save = useDepartmentWrite<Department>();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get('name'));
    save.mutate(
      department
        ? {
            path: `/${department.id}`,
            method: 'PATCH',
            body: { name, active: fields.has('active') },
          }
        : { body: { name, code: String(fields.get('code')) } },
      { onSuccess: (record) => onSave?.(record.id) },
    );
  }
  return (
    <form className="sta-panel sta-stack" onSubmit={submit}>
      <h3>{department ? 'Department settings' : 'New department'}</h3>
      {department ? (
        <p>
          Code <bdi>{department.code}</bdi>
        </p>
      ) : (
        <Field label="Department code">
          <Input name="code" required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
        </Field>
      )}
      <Field label="Department name">
        <Input name="name" required maxLength={200} defaultValue={department?.name} />
      </Field>
      {department && (
        <label>
          <input type="checkbox" name="active" defaultChecked={department.active} /> Active
        </label>
      )}
      <div>
        <Button disabled={save.isPending}>
          {department ? 'Save department' : 'Create department'}
        </Button>
      </div>
      <DepartmentError error={save.error} />
      {save.isSuccess && <p role="status">Department saved.</p>}
    </form>
  );
}

function Plans({ department, canManage }: { department: Department; canManage: boolean }) {
  const plans = useDepartmentRead<CurriculumVersion[]>(`/${department.id}/curricula`);
  const create = useDepartmentWrite<CurriculumVersion>();
  const navigate = useNavigate();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name'));
    create.mutate(
      { path: '/curricula', body: { name, departmentId: department.id, modules: [] } },
      {
        onSuccess: ({ id }) => void navigate(`/department/curricula/${id}`),
      },
    );
  }
  return (
    <>
      <section className="sta-panel sta-stack">
        <h3>Curriculum plans</h3>
        <Resource query={plans}>
          {(versions) =>
            versions.length ? (
              <ul>
                {versions.map((entry) => (
                  <li key={entry.id}>
                    <Link to={`/department/curricula/${entry.id}`}>
                      <bdi>{versionLabel(entry)}</bdi>
                    </Link>{' '}
                    · {entry.publishedAt ? 'Published' : 'Draft'}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No curriculum plans.</p>
            )
          }
        </Resource>
        {canManage && department.active && (
          <form onSubmit={submit} className="sta-actions">
            <Field label="New plan name">
              <Input required name="name" maxLength={200} />
            </Field>
            <Button disabled={create.isPending}>Create draft</Button>
            <DepartmentError error={create.error} />
          </form>
        )}
      </section>
      {canManage && department.active && plans.data && (
        <Assignments department={department} versions={plans.data} />
      )}
    </>
  );
}

function DepartmentHome({ canManage }: { canManage: boolean }) {
  const departments = useDepartmentRead<Department[]>();
  const [params, setParams] = useSearchParams();
  const selected = params.get('department');
  return (
    <div className="sta-stack">
      {canManage && (
        <DepartmentForm key={selected ?? ''} onSave={(id) => setParams({ department: id })} />
      )}
      <Resource query={departments}>
        {(records) => {
          const department = records.find(({ id }) => id === selected);
          return (
            <>
              <Field label="Choose a department">
                <select
                  value={department?.id ?? ''}
                  onChange={(event) =>
                    setParams(event.target.value ? { department: event.target.value } : {})
                  }
                >
                  <option value="">Select a department</option>
                  {records.map(({ id, name, code, active }) => (
                    <option key={id} value={id}>
                      {name} ({code}){active ? '' : ' · Inactive'}
                    </option>
                  ))}
                </select>
              </Field>
              {department && (
                <section className="sta-stack" key={department.id}>
                  <h2>
                    <bdi>{department.name}</bdi>
                    {department.active ? '' : ' · Inactive'}
                  </h2>
                  {canManage && <DepartmentForm department={department} />}
                  <Plans department={department} canManage={canManage} />
                </section>
              )}
            </>
          );
        }}
      </Resource>
    </div>
  );
}

function Workspace() {
  const access = useRead<StudentAffairsCapabilities>('capabilities', 30_000);
  return (
    <Resource query={access}>
      {({ read, administer }) =>
        read ? (
          <Routes>
            <Route index element={<DepartmentHome canManage={administer} />} />
            <Route
              path="curricula/:versionId"
              element={<CurriculumRoute canManage={administer} />}
            />
            <Route path="*" element={<p role="alert">Page not found.</p>} />
          </Routes>
        ) : (
          <p role="alert">Access denied.</p>
        )
      }
    </Resource>
  );
}

export default function App() {
  return (
    <StudentAffairsSession title="Department">
      <Workspace />
    </StudentAffairsSession>
  );
}
