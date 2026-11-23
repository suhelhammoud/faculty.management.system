import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type {
  AssignmentPage,
  AssignmentStudent,
  CurriculumVersion,
  Department,
} from '@project/contracts/department';
import { Button, Field, Input, Resource, studentName } from '../student-affairs/common';
import { useDepartmentRead, useDepartmentWrite } from './api';
import { DepartmentError, versionLabel } from './curricula';

export function Assignments({
  department,
  versions,
}: {
  department: Department;
  versions: CurriculumVersion[];
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [chosenPlan, setChosenPlan] = useState('');
  const [selected, setSelected] = useState<AssignmentStudent[]>([]);
  const [review, setReview] = useState(false);
  const candidates = useDepartmentRead<AssignmentPage>(
    `/${department.id}/students?${new URLSearchParams({ page: String(page), ...(search ? { search } : {}) })}`,
  );
  const assignment = useDepartmentWrite<{ assigned: number }>();
  const published = versions.filter((plan) => plan.publishedAt);
  const plan = published.find(({ id }) => id === chosenPlan) ?? published[0];
  const selectedIds = new Set(selected.map(({ studentId }) => studentId));

  function searchStudents(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(String(new FormData(event.currentTarget).get('search')).trim());
    setPage(1);
  }

  function toggle(student: AssignmentStudent) {
    assignment.reset();
    setSelected((previous) =>
      selectedIds.has(student.studentId)
        ? previous.filter(({ studentId }) => student.studentId !== studentId)
        : [...previous, student],
    );
  }

  return (
    <section className="sta-panel sta-stack">
      <h3>Assign curriculum</h3>
      {!plan ? (
        <p>Publish a curriculum version to assign it.</p>
      ) : (
        <>
          {review ? (
            <div className="sta-stack">
              <h4>Review assignment</h4>
              <p>
                <bdi>
                  {department.name} · {versionLabel(plan)}
                </bdi>
              </p>
              <ul>
                {selected.map((student) => (
                  <li key={student.studentId}>
                    <bdi>
                      {studentName(student)} ({student.academicId})
                    </bdi>
                  </li>
                ))}
              </ul>
              <div className="sta-actions">
                <Button
                  type="button"
                  disabled={assignment.isPending}
                  onClick={() =>
                    assignment.mutate(
                      {
                        path: '/assignments',
                        body: { planId: plan.id, studentIds: [...selectedIds] },
                      },
                      {
                        onSuccess: () => {
                          setReview(false);
                          setSelected([]);
                        },
                        onError: () => {
                          void candidates.refetch();
                        },
                      },
                    )
                  }
                >
                  Assign to {selected.length} students
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={assignment.isPending}
                  onClick={() => setReview(false)}
                >
                  Back to selection
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Field label="Published curriculum version">
                <select
                  value={plan.id}
                  onChange={(event) => {
                    assignment.reset();
                    setChosenPlan(event.target.value);
                  }}
                >
                  {published.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {versionLabel(entry)}
                    </option>
                  ))}
                </select>
              </Field>
              <form onSubmit={searchStudents} className="sta-actions">
                <Field label="Find students by name or academic ID">
                  <Input name="search" maxLength={200} />
                </Field>
                <Button variant="outline">Search</Button>
              </form>
              <Resource query={candidates}>
                {({ records, total }) => (
                  <>
                    {records.length ? (
                      <div className="sta-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Select</th>
                              <th>Academic ID</th>
                              <th>Student</th>
                              <th>Study year</th>
                              <th>Assigned curriculum</th>
                            </tr>
                          </thead>
                          <tbody>
                            {records.map((student) => (
                              <tr key={student.studentId}>
                                <td>
                                  <input
                                    type="checkbox"
                                    aria-label={`Select ${studentName(student)} (${student.academicId})`}
                                    checked={selectedIds.has(student.studentId)}
                                    disabled={
                                      !selectedIds.has(student.studentId) &&
                                      (Boolean(student.assignment) || selected.length >= 500)
                                    }
                                    onChange={() => toggle(student)}
                                  />
                                </td>
                                <td>
                                  <bdi>{student.academicId}</bdi>
                                </td>
                                <td>
                                  <Link to={`/student-affairs/students/${student.studentId}`}>
                                    <bdi>{studentName(student)}</bdi>
                                  </Link>
                                </td>
                                <td>{student.currentStudyYear ?? '—'}</td>
                                <td>
                                  {student.assignment ? versionLabel(student.assignment) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p>No students on this page.</p>
                    )}
                    <div className="sta-actions">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Previous
                      </Button>
                      <span>Page {page}</span>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={page * 50 >= total}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </>
                )}
              </Resource>
              <div className="sta-actions">
                <Button
                  type="button"
                  disabled={!selected.length}
                  onClick={() => {
                    setChosenPlan(plan.id);
                    setReview(true);
                  }}
                >
                  Review {selected.length} selected
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selected.length}
                  onClick={() => {
                    setSelected([]);
                    assignment.reset();
                  }}
                >
                  Clear selection
                </Button>
              </div>
            </>
          )}
          <DepartmentError error={assignment.error} />
          {assignment.data && <p role="status">Assigned to {assignment.data.assigned} students.</p>}
        </>
      )}
    </section>
  );
}
