import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import App from '../App';
import { useUi } from '../lib/store';
import { i18n } from '../lib/i18n';
import type { Employee, Reference, Session } from '../lib/types';

const category = '7c580676-46e1-41e6-80f2-d126fb3d68d7';
const otherCategory = '7c580676-46e1-41e6-80f2-d126fb3d68d8';
const position = '7c580676-46e1-41e6-80f2-d126fb3d68d9';
const employeeId = '7c580676-46e1-41e6-80f2-d126fb3d68da';
let session: Session;
let employee: Employee;
let forbidden: boolean;
let conflict: boolean;
let failLogin: boolean;
let expired: boolean;
let references: Record<string, Reference[]>;
const requests: { path: string; method: string; body: Record<string, unknown> | undefined }[] = [];
function Location() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function mount(path = '/hr/employees') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/hr/*"
          element={
            <>
              <App />
              <Location />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}
const adminSession: Session = {
  user: {
    id: 'user',
    name: 'HR Admin',
    username: 'hr-admin',
    approved: true,
    enabled: true,
    mustChangePassword: false,
  },
};

beforeEach(async () => {
  localStorage.clear();
  useUi.setState({ language: 'en' });
  await i18n.changeLanguage('en');
  session = structuredClone(adminSession);
  forbidden = false;
  conflict = false;
  failLogin = false;
  expired = false;
  requests.length = 0;
  employee = {
    employeeId,
    employeeNumber: 'EMP-1',
    firstNameAr: 'سارة',
    lastNameAr: 'حسن',
    firstNameEn: 'Sara',
    lastNameEn: 'Hasan',
    email: null,
    employment: null,
  } as Employee;
  references = {
    'staff-categories': [
      { categoryId: category, code: 'A', nameAr: 'إداري', nameEn: 'Administrative' },
      { categoryId: otherCategory, code: 'B', nameAr: 'تقني', nameEn: 'Technical' },
    ],
    positions: [
      {
        positionId: position,
        categoryId: category,
        code: 'CLERK',
        nameAr: 'كاتب',
        nameEn: 'Clerk',
      },
    ],
    'academic-ranks': [],
    'grade-schemes': [],
    'employment-grades': [],
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options?: RequestInit) => {
      const url = new URL(input);
      const path = url.pathname;
      const method = options?.method || 'GET';
      const body = options?.body ? JSON.parse(String(options.body)) : undefined;
      requests.push({ path: path + url.search, method, body });
      const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      if (path.endsWith('auth/get-session')) return json(session);
      if (path.endsWith('auth/sign-in/username')) {
        if (failLogin) return json({ message: 'Invalid credentials' }, 401);
        session = structuredClone(adminSession);
        return json({});
      }
      if (path.endsWith('auth/sign-out')) {
        session = null;
        return json({});
      }
      if (path.endsWith('admin/change-password')) {
        session = null;
        return json({});
      }
      if (expired) return json({ message: 'Expired' }, 401);
      if (forbidden) return json({ message: 'Forbidden' }, 403);
      if (method !== 'GET' && conflict) {
        conflict = false;
        return json({ message: 'Duplicate' }, 409);
      }
      if (path.endsWith('/employment')) {
        employee.employment = { ...body, employmentRecordId: 'employment' };
        return json(employee.employment);
      }
      if (path.endsWith('/employees') && method === 'GET')
        return json({ records: [employee], page: 1, pageSize: 20, total: 1 });
      if (path.endsWith('/employees') && method === 'POST') {
        employee = { ...employee, ...body };
        return json(employee, 201);
      }
      if (path.endsWith(`/employees/${employeeId}`)) {
        if (method === 'PATCH') employee = { ...employee, ...body };
        return json(employee);
      }
      const kind = path.split('/')[4];
      if (references[kind]) {
        if (method === 'POST') {
          const row = { ...body, categoryId: 'new-category' };
          references[kind].push(row);
          return json(row, 201);
        }
        return json(references[kind]);
      }
      return json({ message: 'Not found' }, 404);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('HR application', () => {
  it('starts in English, switches to Arabic and preserves the language on remount', async () => {
    const user = userEvent.setup();
    const view = mount();
    await screen.findByRole('heading', { name: 'Employees' });
    expect(document.querySelector('.faculty-hr')).toHaveAttribute('dir', 'ltr');
    await user.click(screen.getByRole('button', { name: 'Switch to Arabic' }));
    await screen.findByRole('heading', { name: 'الموظفون' });
    expect(document.querySelector('.faculty-hr')).toHaveAttribute('dir', 'rtl');
    expect(localStorage.getItem('faculty-language')).toBe('ar');
    view.unmount();
    mount();
    await screen.findByRole('heading', { name: 'الموظفون' });
  });

  it('signs in at the requested URL and signs out without exposing personnel data', async () => {
    session = null;
    const user = userEvent.setup();
    mount(`/hr/employees/${employeeId}`);
    await screen.findByRole('button', { name: 'Sign in' });
    await user.type(screen.getByLabelText(/Username/), 'hr-admin');
    await user.type(screen.getByLabelText(/^Password/), 'temporary-password');
    failLogin = true;
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Invalid username or password.');
    expect(screen.getByLabelText(/Username/)).toHaveValue('hr-admin');
    failLogin = false;
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: 'Sara Hasan' });
    expect(screen.getByTestId('location')).toHaveTextContent(`/hr/employees/${employeeId}`);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('button', { name: 'Sign in' });
    expect(screen.queryByText('Sara Hasan')).not.toBeInTheDocument();
  });

  it('handles password change, pending approval and disabled-account states', async () => {
    session!.user.mustChangePassword = true;
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { name: 'Change password' });
    await user.type(screen.getByLabelText(/Current password/), 'temporary-password');
    await user.type(screen.getByLabelText(/^New password/), 'new-secure-password');
    await user.type(screen.getByLabelText(/Confirm password/), 'different-password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await screen.findByText('Passwords do not match.');
    await user.clear(screen.getByLabelText(/Confirm password/));
    await user.type(screen.getByLabelText(/Confirm password/), 'new-secure-password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await screen.findByText('Sign in again with your new password.');
  });

  it.each(['pending', 'disabled'])('blocks HR data for a %s account', async (state) => {
    if (state === 'pending') session!.user.approved = false;
    else session!.user.enabled = false;
    mount();
    await screen.findByText(
      state === 'pending' ? 'Awaiting approval' : 'Your account is disabled.',
    );
    expect(requests.some((r) => r.path.includes('/admin/hr/'))).toBe(false);
  });

  it('puts search and filters in the URL and restores a direct URL', async () => {
    const user = userEvent.setup();
    mount('/hr/employees?search=Sara&page=1&pageSize=10');
    await screen.findByText('Sara Hasan');
    expect(screen.getByLabelText('Search')).toHaveValue('Sara');
    await user.selectOptions(screen.getByLabelText('Staff category'), category);
    await user.selectOptions(screen.getByLabelText('Position'), position);
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(`categoryId=${category}`),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('page=1');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(screen.getByLabelText('Search')).toHaveValue(''));
  });

  it('creates a profile without employment and retains values after a duplicate error', async () => {
    const user = userEvent.setup();
    mount('/hr/employees/new');
    await screen.findByRole('button', { name: 'Create employee' });
    await user.type(screen.getByLabelText(/Employee number/), ' EMP-2 ');
    await user.type(screen.getByLabelText(/First name \(Arabic\)/), 'سارة');
    await user.type(screen.getByLabelText(/Last name \(Arabic\)/), 'حسن');
    conflict = true;
    await user.click(screen.getByRole('button', { name: 'Create employee' }));
    await screen.findByText('A record with these values already exists.');
    expect(screen.getByLabelText(/Employee number/)).toHaveValue(' EMP-2 ');
    await user.click(screen.getByRole('button', { name: 'Create employee' }));
    await screen.findByText('No employment information yet.');
    expect(
      requests.find((r) => r.method === 'POST' && r.path.endsWith('/employees'))?.body,
    ).toMatchObject({ employeeNumber: 'EMP-2', email: null });
    expect(requests.some((r) => r.method === 'PUT')).toBe(false);
    expect(screen.getByTestId('location')).toHaveTextContent(`/hr/employees/${employeeId}`);
  });

  it('edits employment, clears an incompatible position, and keeps personal saves separate', async () => {
    const user = userEvent.setup();
    mount(`/hr/employees/${employeeId}/edit`);
    const save = await screen.findByRole('button', { name: 'Save employment information' });
    const employmentForm = save.closest('form')!;
    await user.selectOptions(within(employmentForm).getByLabelText(/Staff category/), category);
    await user.selectOptions(within(employmentForm).getByLabelText(/Position/), position);
    await user.selectOptions(
      within(employmentForm).getByLabelText(/Staff category/),
      otherCategory,
    );
    expect(within(employmentForm).getByLabelText(/Position/)).toHaveValue('');
    await user.selectOptions(within(employmentForm).getByLabelText(/Staff category/), category);
    await user.selectOptions(within(employmentForm).getByLabelText(/Position/), position);
    await user.type(within(employmentForm).getByLabelText(/Employment regime/), 'Faculty staff');
    await user.type(within(employmentForm).getByLabelText(/Start date/), '01/01/2026');
    await user.click(save);
    await screen.findByText('Saved successfully.');
    expect(requests.find((r) => r.method === 'PUT')?.body).toMatchObject({
      categoryId: category,
      positionId: position,
      academicRankId: null,
      gradeId: null,
      startDate: '2026-01-01',
    });
    expect(requests.some((r) => r.method === 'PATCH')).toBe(false);
  });

  it('creates reference data in a keyboard-accessible dialog', async () => {
    const user = userEvent.setup();
    mount('/hr/settings/staff-categories');
    await screen.findByRole('button', { name: 'Add record' });
    await user.click(screen.getByRole('button', { name: 'Add record' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Code/), 'NEW');
    await user.type(within(dialog).getByLabelText(/Name \(Arabic\)/), 'جديد');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved successfully.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      requests.find((r) => r.method === 'POST' && r.path.endsWith('/staff-categories'))?.body,
    ).toMatchObject({ code: 'NEW', nameAr: 'جديد', nameEn: null });
  });

  it('clears cached personnel data when a request reports session expiry', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText('Sara Hasan');
    expired = true;
    session = null;
    await user.type(screen.getByLabelText('Search'), 'new-query');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await screen.findByRole('button', { name: 'Sign in' });
    expect(screen.queryByText('Sara Hasan')).not.toBeInTheDocument();
  });

  it('shows access errors and a not-found page for an unknown HR route', async () => {
    forbidden = true;
    const view = mount();
    await screen.findAllByText('You do not have permission, or your account is restricted.');
    expect(screen.queryByText('Sara Hasan')).not.toBeInTheDocument();
    view.unmount();
    mount('/hr/unknown');
    await screen.findByRole('heading', { name: 'Page not found' });
  });
});
