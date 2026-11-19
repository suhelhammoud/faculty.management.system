import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
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
  await page.route('http://localhost:4301/remoteEntry.js', (route) =>
    route.abort('connectionrefused'),
  );
});

test('loads an HR deep link without requesting the Attendance remote', async ({ page }) => {
  const requestedEntries: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/remoteEntry.js')) {
      requestedEntries.push(request.url());
    }
  });

  await page.goto('/hr/employees');

  await expect(page.getByRole('heading', { name: 'Employees', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New employee' })).toHaveCSS(
    'justify-content',
    'center',
  );
  await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toBeVisible();
  expect(requestedEntries).toContain('http://localhost:4305/remoteEntry.js');
  expect(requestedEntries).not.toContain('http://localhost:4301/remoteEntry.js');
});

test('shows the remote fallback and lets users navigate to HR', async ({ page }) => {
  await page.goto('/attendance');

  await expect(page.getByRole('alert')).toHaveText(/Unable to load this module/);
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Faculty modules' })
    .getByRole('link', { name: 'HR' })
    .click();

  await expect(page).toHaveURL(/\/hr\/employees$/);
  await expect(page.getByRole('heading', { name: 'Employees', exact: true })).toBeVisible();
});
