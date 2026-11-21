import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const manifestPath = new URL(
  '../../../dist/frontend-smoke-build/web/.vite/manifest.json',
  import.meta.url,
);

async function moduleChunks() {
  const manifest: Record<string, { file: string }> = JSON.parse(
    await readFile(manifestPath, 'utf8'),
  );
  return {
    attendance: `/${manifest['src/modules/attendance/App.tsx'].file}`,
    hr: `/${manifest['src/modules/hr/App.tsx'].file}`,
  };
}

function moduleLink(page: Page, name: string) {
  return page
    .getByRole('navigation', { name: 'Faculty modules' })
    .getByRole('link', { name, exact: true });
}

async function mockHrSession(page: Page) {
  await page.route('**/api/auth/get-session', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'hr-user',
          name: 'HR Admin',
          username: 'hr-admin',
          approved: true,
          enabled: true,
          mustChangePassword: false,
        },
      },
    }),
  );
  await page.route(/\/api\/admin\/hr\/(staff-categories|positions)$/, (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route(/\/api\/admin\/hr\/employees\?/, (route) =>
    route.fulfill({ json: { records: [], page: 1, pageSize: 20, total: 0 } }),
  );
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
});

for (const [path, heading] of [
  ['/admin', 'Faculty administration'],
  ['/attendance', 'Attendance'],
  ['/maintenance', 'Maintenance'],
  ['/supervision', 'Supervision'],
  ['/meetings', 'Meetings'],
  ['/exams', 'Exams'],
  ['/correspondence', 'Correspondence'],
  ['/inventory', 'Inventory'],
  ['/student-affairs', 'Student Affairs'],
  ['/facilities/rooms', 'Facilities'],
]) {
  test(`opens ${path} directly`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.getByRole('main').getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  });
}

test('loads an HR deep link and fetches Attendance only when visited', async ({ page }) => {
  await mockHrSession(page);
  const chunks = await moduleChunks();
  const requestedPaths = new Set<string>();
  page.on('request', (request) => requestedPaths.add(new URL(request.url()).pathname));

  await page.goto('/hr/employees?search=Alex');
  await expect(page.getByRole('heading', { name: 'Employees', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New employee' })).toHaveCSS(
    'justify-content',
    'center',
  );
  await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toHaveValue('Alex');
  expect(requestedPaths.has(chunks.hr)).toBe(true);
  expect(requestedPaths.has(chunks.attendance)).toBe(false);

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toHaveValue('Alex');
  await moduleLink(page, 'Attendance').click();
  await expect(page.getByRole('heading', { name: 'Attendance', exact: true })).toBeVisible();
  expect(requestedPaths.has(chunks.attendance)).toBe(true);

  await page.goBack();
  await expect(page).toHaveURL(/\/hr\/employees\?search=Alex$/);
  await expect(page.getByRole('heading', { name: 'Employees', exact: true })).toBeVisible();
});

test('shows the module fallback and lets users navigate to HR', async ({ page }) => {
  await mockHrSession(page);
  const { attendance } = await moduleChunks();
  await page.route(`**${attendance}`, (route) => route.abort('connectionrefused'));
  await page.goto('/attendance');

  await expect(page.getByRole('alert')).toHaveText(/Unable to load this module/);
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await moduleLink(page, 'HR').click();

  await expect(page).toHaveURL(/\/hr\/employees$/);
  await expect(page.getByRole('heading', { name: 'Employees', exact: true })).toBeVisible();
});

test('preserves feature styles and scopes Facilities direction during navigation', async ({
  page,
}) => {
  await page.goto('/facilities/rooms');
  await page.getByRole('button', { name: 'Switch to Arabic' }).click();
  await expect(page.locator('.faculty-facilities')).toHaveAttribute('dir', 'rtl');
  await expect(moduleLink(page, 'Attendance')).toHaveCSS('direction', 'ltr');

  await moduleLink(page, 'Administration').click();
  const signIn = page.getByRole('button', { name: 'Sign in', exact: true });
  await expect(signIn).toHaveCSS('background-color', 'rgb(22, 78, 99)');

  await moduleLink(page, 'Inventory').click();
  await expect(signIn).toHaveCSS('background-color', 'rgb(29, 72, 88)');

  await mockHrSession(page);
  await moduleLink(page, 'HR').click();
  await expect(page.getByRole('link', { name: 'New employee' })).toHaveCSS(
    'justify-content',
    'center',
  );
  await expect(moduleLink(page, 'HR')).toHaveCSS('direction', 'ltr');
});

test('preserves the shared Workflow and fallback routes', async ({ page }) => {
  await page.route('**/api/workflow/tasks', (route) => route.fulfill({ json: [] }));
  await page.goto('/');
  await expect(page).toHaveURL(/\/attendance$/);
  await moduleLink(page, 'Workflows').click();
  await expect(page).toHaveURL(/\/workflow\/tasks$/);
  await expect(page.getByText('No tasks are available.')).toBeVisible();

  await page.route('**/api/workflow/tasks/task-id', (route) => route.fulfill({ status: 404 }));
  await page.goto('/workflow/tasks/task-id');
  await expect(page.getByRole('heading', { name: 'Review task' })).toBeVisible();
  await page.goto('/missing-module');
  await expect(page.getByRole('alert')).toHaveText('Page not found.');
});
