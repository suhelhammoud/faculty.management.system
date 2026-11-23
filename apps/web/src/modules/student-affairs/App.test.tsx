import { focusManager } from '@tanstack/react-query';
import { useFacultyLanguage } from '@/components/language-preference';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const base = '/student-affairs';
const api = '/api/student-affairs';
const id = 'student-one';
const profile = {
  studentId: id,
  revision: 1,
  academicId: 'DEMO-STA-002',
  firstName: 'ليلى',
  fatherName: null,
  lastName: 'أحمد',
  currentStudyYear: 2,
  birthDate: '2002-01-14',
  gradeAverage: '91.25',
  adjustedScore: '90.25',
};
const staff = { read: true, administer: false, grantPromotions: false, assignedStudyYears: [1] };
const admin = { ...staff, administer: true, assignedStudyYears: [] };
const dean = { read: false, administer: false, grantPromotions: true, assignedStudyYears: [] };
const account = (userId: string) => ({
  user: {
    id: userId,
    username: userId,
    name: userId,
    approved: true,
    enabled: true,
    mustChangePassword: false,
  },
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
type Handler = (url: URL, request?: RequestInit) => Response;

function mount(path: string, routes: Record<string, unknown | Handler>) {
  const fetch = vi.fn((input: string, request?: RequestInit) => {
    const url = new URL(input);
    const response = routes[url.pathname] ?? (url.pathname === '/api/department' ? [] : undefined);
    if (typeof response === 'function') return Promise.resolve((response as Handler)(url, request));
    return Promise.resolve(response === undefined ? json({}, 404) : json(response));
  });
  vi.stubGlobal('fetch', fetch);
  const app = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={`${base}/*`} element={<App />} />
      </Routes>
    </MemoryRouter>,
  );
  return { fetch, ...app };
}

beforeEach(() => {
  useFacultyLanguage.getState().setLanguage('en');
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('Student Affairs workspace', () => {
  it('limits new students to assigned years and keeps a draft after a duplicate ID error', async () => {
    const create = vi.fn((request?: RequestInit) => {
      expect(JSON.parse(String(request?.body))).toEqual({
        academicId: '00042',
        firstName: 'Lina',
        fatherName: 'Omar',
        lastName: 'Salem',
        currentStudyYear: 1,
      });
      return json({ message: 'Academic ID is already in use' }, 409);
    });
    mount(`${base}/students/new`, {
      '/api/auth/get-session': account('staff'),
      [`${api}/capabilities`]: staff,
      [`${api}/students`]: (_url: URL, request?: RequestInit) => create(request),
    });
    const year = await screen.findByLabelText('Current study year');
    expect(screen.queryByRole('option', { name: 'Year 2' })).not.toBeInTheDocument();
    fireEvent.change(year, { target: { value: '1' } });
    for (const [label, value] of [
      ['Academic ID', '00042'],
      ['First name', 'Lina'],
      ['Father’s name', 'Omar'],
      ['Last name', 'Salem'],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Academic ID is already in use');
    expect(screen.getByLabelText('Academic ID')).toHaveValue('00042');
  });

  it('filters the registry on a deep link, reads across years, and permits historical remarks only in scope', async () => {
    const annualWrite = vi.fn<Handler>(() => json({}));
    const { fetch } = mount(`${base}/students?search=DEMO-STA&studyYear=2&page=2`, {
      '/api/auth/get-session': account('staff'),
      [`${api}/capabilities`]: staff,
      [`${api}/students`]: () => json({ records: [profile], page: 2, pageSize: 20, total: 30 }),
      [`${api}/students/${id}`]: profile,
      [`${api}/students/${id}/academic-years`]: [
        { academicYear: '2025-2026', year: 1, remarks: 'Historical' },
      ],
      [`${api}/students/${id}/academic-years/2025-2026`]: annualWrite,
    });
    fireEvent.click(await screen.findByRole('link', { name: 'ليلى أحمد' }));
    expect(
      fetch.mock.calls.some(([url]) => url.includes('page=2&search=DEMO-STA&studyYear=2')),
    ).toBe(true);
    expect(await screen.findByText('90.25')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit profile' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Annual records' }));
    expect(screen.queryByRole('button', { name: 'Add annual record' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit annual record 2025-2026' }));
    fireEvent.change(screen.getByLabelText('Remarks'), { target: { value: 'Corrected' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(annualWrite).toHaveBeenCalled());
    expect(JSON.parse(String(annualWrite.mock.calls[0][1]?.body))).toEqual({
      remarks: 'Corrected',
    });
  });

  it('submits only changed profile fields for a legacy student and switches to Arabic RTL', async () => {
    const patch = vi.fn((request?: RequestInit) => {
      expect(JSON.parse(String(request?.body))).toEqual({
        fatherName: 'خالد',
        expectedRevision: 1,
      });
      return json({ ...profile, fatherName: 'خالد' });
    });
    mount(`${base}/students/${id}/edit`, {
      '/api/auth/get-session': account('admin'),
      [`${api}/capabilities`]: admin,
      [`${api}/students/${id}`]: (_url: URL, request?: RequestInit) =>
        request?.method === 'PATCH' ? patch(request) : json(profile),
      [`${api}/promotion-grants/current`]: { grant: null },
    });
    expect(await screen.findByDisplayValue('14/01/2002')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Father’s name'), { target: { value: 'خالد' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(patch).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'العربية' }));
    expect(await screen.findByRole('heading', { name: 'شؤون الطلاب' })).toBeInTheDocument();
    expect(document.querySelector('.faculty-student-affairs')).toHaveAttribute('dir', 'rtl');
  });

  it('keeps the edit baseline through a refresh and retains the draft on a stale revision', async () => {
    let latest = profile;
    const patch = vi.fn((request?: RequestInit) => {
      expect(JSON.parse(String(request?.body))).toEqual({ notes: 'My draft', expectedRevision: 1 });
      return json(
        {
          code: 'STUDENT_REVISION_CONFLICT',
          message: 'This student record changed while you were editing.',
        },
        409,
      );
    });
    const read = vi.fn(() => json(latest));
    mount(`${base}/students/${id}/edit`, {
      '/api/auth/get-session': account('admin'),
      [`${api}/capabilities`]: admin,
      [`${api}/students/${id}`]: (_url: URL, request?: RequestInit) =>
        request?.method === 'PATCH' ? patch(request) : read(),
    });
    expect(await screen.findByDisplayValue('14/01/2002')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'My draft' } });
    latest = { ...profile, birthDate: '2002-02-15', revision: 2 };
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Reload latest record' })).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toHaveValue('My draft');
    expect(patch).toHaveBeenCalledOnce();
    focusManager.setFocused(undefined);
  });

  it('lets an admin change individual staff assignments', async () => {
    let years = [2];
    const put = vi.fn(() => {
      years = [2, 3];
      return new Response(null, { status: 204 });
    });
    mount(`${base}/staff-year-assignments`, {
      '/api/auth/get-session': account('admin'),
      [`${api}/capabilities`]: admin,
      [`${api}/staff-year-assignments`]: () =>
        json([{ userId: 'staff', name: 'Staff One', years }]),
      [`${api}/staff-year-assignments/staff/3`]: put,
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Assign Year 3 · Staff One' }));
    expect(
      await screen.findByRole('button', { name: 'Remove Year 3 · Staff One' }),
    ).toBeInTheDocument();
    expect(put).toHaveBeenCalledOnce();
  });

  it('issues, uses, and revokes a shared promotion grant without loading the registry as dean', async () => {
    let active: Record<string, unknown> | null = null;
    let studyYear = 2;
    const routes = {
      '/api/auth/get-session': account('dean'),
      [`${api}/capabilities`]: dean,
      [`${api}/promotion-grants/recipients`]: [{ userId: 'admin', name: 'Student Admin' }],
      [`${api}/promotion-grants`]: (_url: URL, request?: RequestInit) => {
        if (request?.method !== 'POST') return json(active ? [active] : []);
        active = {
          ...JSON.parse(String(request.body)),
          id: 'grant-one',
          issuedBy: 'dean',
          issuedAt: new Date().toISOString(),
          revokedAt: null,
          revokedBy: null,
        };
        return json(active, 201);
      },
      [`${api}/promotion-grants/grant-one`]: () => {
        active = { ...active, revokedAt: new Date().toISOString(), revokedBy: 'dean' };
        return new Response(null, { status: 204 });
      },
      [`${api}/promotion-grants/current`]: () => json({ grant: active?.revokedAt ? null : active }),
      [`${api}/students/${id}`]: () => json({ ...profile, currentStudyYear: studyYear }),
      [`${api}/students/${id}/current-study-year`]: (_url: URL, request?: RequestInit) => {
        studyYear = JSON.parse(String(request?.body)).currentStudyYear;
        return json({ ...profile, currentStudyYear: studyYear });
      },
    };
    let view = mount(base, routes);
    fireEvent.change(await screen.findByLabelText('Recipient'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Expiry date and time'), {
      target: { value: '2099-06-01T12:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Issue grant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm grant' }));
    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(view.fetch.mock.calls.some(([url]) => url.includes('/students'))).toBe(false);
    view.unmount();

    routes['/api/auth/get-session'] = account('admin');
    routes[`${api}/capabilities`] = admin;
    view = mount(`${base}/students/${id}`, routes);
    fireEvent.change(await screen.findByLabelText('Destination year'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change study year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm year change' }));
    expect(await screen.findByText('Study year updated.')).toBeInTheDocument();
    expect(studyYear).toBe(3);
    view.unmount();

    routes['/api/auth/get-session'] = account('dean');
    routes[`${api}/capabilities`] = dean;
    view = mount(base, routes);
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke grant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm revocation' }));
    expect(await screen.findByText('Revoked')).toBeInTheDocument();
    view.unmount();

    routes['/api/auth/get-session'] = account('admin');
    routes[`${api}/capabilities`] = admin;
    mount(`${base}/students/${id}`, routes);
    expect(await screen.findByText('No active dean grant.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Destination year')).not.toBeInTheDocument();
  });

  it('refreshes grant status after a denied move and clears student data on sign-out', async () => {
    let current: ReturnType<typeof account> | null = account('admin');
    let revoked = false;
    mount(`${base}/students/${id}`, {
      '/api/auth/get-session': () => json(current),
      '/api/auth/sign-out': () => {
        current = null;
        return json({});
      },
      [`${api}/capabilities`]: admin,
      [`${api}/students/${id}`]: profile,
      [`${api}/promotion-grants/current`]: () =>
        json({
          grant: revoked
            ? null
            : {
                id: 'grant',
                expiresAt: '2099-05-01T12:00:00Z',
                revokedAt: null,
              },
        }),
      [`${api}/students/${id}/current-study-year`]: () => {
        revoked = true;
        return json({ message: 'An active dean promotion grant is required' }, 403);
      },
    });
    fireEvent.change(await screen.findByLabelText('Destination year'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change study year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm year change' }));
    expect(await screen.findByText('No active dean grant.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'An active dean promotion grant is required',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByLabelText('Username')).toBeInTheDocument();
    expect(screen.queryByText('90.25')).not.toBeInTheDocument();
  });

  it('refreshes an expired grant and leaves the year change unavailable', async () => {
    let calls = 0;
    mount(`${base}/students/${id}`, {
      '/api/auth/get-session': account('admin'),
      [`${api}/capabilities`]: admin,
      [`${api}/students/${id}`]: profile,
      [`${api}/promotion-grants/current`]: () =>
        json({
          grant:
            ++calls === 1
              ? {
                  id: 'expired',
                  expiresAt: '2000-01-01T00:00:00Z',
                  revokedAt: null,
                }
              : null,
        }),
    });
    expect(await screen.findByText('No active dean grant.')).toBeInTheDocument();
    await waitFor(() => expect(calls).toBeGreaterThan(1));
    expect(screen.queryByLabelText('Destination year')).not.toBeInTheDocument();
  });
});
