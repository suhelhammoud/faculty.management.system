import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';

afterEach(() => vi.unstubAllGlobals());

it('defaults to the newest published version and reviews multiple students before assigning', async () => {
  const department = { id: 'department-a', name: 'Engineering', code: 'engineering', active: true };
  const version = { familyId: 'plan', departmentId: department.id, name: 'Core', revision: 1 };
  const versions = [
    { ...version, id: 'draft', version: 3, publishedAt: null },
    { ...version, id: 'published', version: 2, publishedAt: '2026-01-01' },
    { ...version, id: 'older', version: 1, publishedAt: '2025-01-01' },
  ];
  const students = ['Lina', 'Samir', 'Omar'].map((firstName, index) => ({
    studentId: String(index),
    academicId: `A${index}`,
    currentStudyYear: 1,
    firstName,
    assignment: index === 2 ? versions[2] : null,
  }));
  const assign = vi.fn();
  const fetch = vi.fn(async (input: string, init?: RequestInit) => {
    const { pathname } = new URL(input);
    const data = {
      '/api/auth/get-session': {
        user: { id: 'admin', name: 'Admin', approved: true, enabled: true },
      },
      '/api/student-affairs/capabilities': { read: true, administer: true },
      '/api/department': [department],
      '/api/department/department-a/curricula': versions,
      '/api/department/department-a/students': { records: students, total: students.length },
    }[pathname];
    if (pathname === '/api/department/assignments') {
      assign(JSON.parse(String(init?.body)));
      return Response.json({ assigned: 2 });
    }
    return Response.json(data ?? {}, { status: data ? 200 : 404 });
  });
  vi.stubGlobal('fetch', fetch);
  render(
    <MemoryRouter initialEntries={['/department?department=department-a']}>
      <Routes>
        <Route path="/department/*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByLabelText('Published curriculum version')).toHaveValue('published');
  expect(await screen.findByRole('checkbox', { name: 'Select Omar (A2)' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Lina (A0)' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Samir (A1)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Review 2 selected' }));
  expect(screen.getByText('Engineering · Core · v2')).toBeInTheDocument();
  const review = screen.getByRole('heading', { name: 'Review assignment' }).parentElement!;
  expect(within(review).getAllByRole('listitem')).toHaveLength(2);
  expect(assign).not.toHaveBeenCalled();
  fireEvent.click(within(review).getByRole('button', { name: 'Assign to 2 students' }));
  await waitFor(() =>
    expect(assign).toHaveBeenCalledWith({ planId: 'published', studentIds: ['0', '1'] }),
  );
  expect(await screen.findByRole('status')).toHaveTextContent('Assigned to 2 students.');
});

it('edits plan details, bilingual names, and grading fields with unspecified credits', async () => {
  const plan = {
    id: 'draft',
    familyId: 'plan',
    departmentId: 'department-a',
    name: 'Curriculum',
    revision: 1,
    version: 1,
    publishedAt: null,
    modules: [
      {
        id: 'database-row',
        planId: 'draft',
        studyYear: 1,
        semester: 1,
        name: 'Programming I',
        nameAr: 'برمجة (1)',
        code: 'Y1-S1-01',
        theoryHours: 2,
        labHours: 2,
        credits: null,
        theoryMarks: 70,
        practicalMarks: 30,
        totalMarks: 100,
        progressMarks: null,
        requirement: 'required',
      },
    ],
  };
  const save = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const { pathname } = new URL(input);
      if (init?.method === 'PATCH') {
        save(JSON.parse(String(init.body)));
        return Response.json(plan);
      }
      const data = {
        '/api/auth/get-session': {
          user: { id: 'admin', name: 'Admin', approved: true, enabled: true },
        },
        '/api/student-affairs/capabilities': { read: true, administer: true },
        '/api/department': [{ id: 'department-a', active: true }],
        '/api/department/curricula/draft': plan,
      }[pathname];
      return Response.json(data ?? {}, { status: data ? 200 : 404 });
    }),
  );

  render(
    <MemoryRouter initialEntries={['/department/curricula/draft']}>
      <Routes>
        <Route path="/department/*" element={<App />} />
      </Routes>
    </MemoryRouter>,
  );

  const arabicName = await screen.findByLabelText('Arabic name');
  expect(arabicName).toHaveValue('برمجة (1)');
  expect(screen.getByLabelText('Credits')).toHaveValue(null);
  fireEvent.change(screen.getByLabelText('Plan title'), {
    target: { value: 'Engineering Curriculum' },
  });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Five-year plan' } });
  fireEvent.change(screen.getByLabelText('Adoption date'), { target: { value: '01/10/2025' } });
  fireEvent.change(screen.getByLabelText('Ministry decision'), {
    target: { value: 'Decision 42' },
  });
  fireEvent.change(screen.getByLabelText('Remarks'), {
    target: { value: 'Applies to new students' },
  });
  fireEvent.change(arabicName, { target: { value: 'البرمجة (1)' } });
  fireEvent.change(screen.getByLabelText('Project progress marks'), { target: { value: '30' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  const { id: _id, planId: _planId, ...module } = plan.modules[0];
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      name: 'Engineering Curriculum',
      description: 'Five-year plan',
      adoptionDate: '2025-10-01',
      ministryDecision: 'Decision 42',
      remarks: 'Applies to new students',
      expectedRevision: 1,
      modules: [{ ...module, nameAr: 'البرمجة (1)', progressMarks: 30 }],
    }),
  );
});
