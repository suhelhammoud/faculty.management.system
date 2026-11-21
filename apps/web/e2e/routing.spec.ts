import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';

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

function allModulesLink(page: Page) {
  return page.locator('main header').getByRole('link', { name: 'All modules', exact: true });
}

async function expectSameRow(...controls: Locator[]) {
  const centers = await Promise.all(
    controls.map((control) =>
      control.evaluate((element) => {
        const { y, height } = element.getBoundingClientRect();
        return y + height / 2;
      }),
    ),
  );
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(1);
}

for (const [path, moduleName] of [
  ['/hr/employees', 'HR'],
  ['/inventory', 'Inventory'],
  ['/facilities/rooms', 'Facilities'],
]) {
  test(`aligns the directory link with the ${moduleName} language switch`, async ({ page }) => {
    const link = allModulesLink(page);
    const languageButton = link.locator('..').getByRole('button');

    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      if (width === 320) {
        await languageButton.click();
        await expect(page.locator('main > section')).toHaveAttribute('dir', 'rtl');
      }

      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute('dir', 'ltr');
      await expect(link).toBeInViewport({ ratio: 1 });
      await expect(languageButton).toBeInViewport({ ratio: 1 });
      await expectSameRow(link, languageButton);

      await link.click();
      await expect(moduleLink(page, moduleName)).toBeVisible();
    }
  });

  test(`signs in and out through the ${moduleName} header`, async ({ page }) => {
    let signedIn = false;
    const user = {
      id: 'faculty-user',
      name: 'Faculty User',
      username: 'faculty_user',
      approved: false,
      enabled: true,
      mustChangePassword: false,
    };
    const password = 'test-password';
    await page.route('**/api/auth/get-session', (route) =>
      route.fulfill({ json: signedIn ? { user } : null }),
    );
    await page.route('**/api/auth/sign-in/username', (route) => {
      expect(route.request().postDataJSON()).toEqual({ username: user.username, password });
      signedIn = true;
      return route.fulfill({ json: {} });
    });
    await page.route('**/api/auth/sign-out', (route) => {
      signedIn = false;
      return route.fulfill({ json: {} });
    });

    await page.goto(path);
    const header = page.locator('main > section > header');
    const languageButton = allModulesLink(page).locator('..').getByRole('button');
    const signIn = header.getByRole('button', { name: 'Sign in', exact: true });
    const signOut = header.getByRole('button', { name: 'Sign out', exact: true });
    const username = page.getByLabel(/^Username/);
    await expect(signIn).toBeVisible();
    await expectSameRow(languageButton, signIn);

    await signIn.click();
    await expect(username).toBeFocused();
    await username.fill(user.username);
    await page.getByLabel(/^Password/).fill(password);
    await signIn.click();

    await expect(signOut).toBeVisible();
    await expectSameRow(languageButton, header.getByText(user.username), signOut);
    await expect(page.getByText('Awaiting approval', { exact: true })).toBeVisible();
    await signOut.click();
    await expect(signIn).toBeVisible();
    await expect(header.getByText(user.username)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  });
}

async function mockSession(page: Page) {
  await page.route('**/api/auth/get-session', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'faculty-user',
          name: 'Faculty User',
          username: 'faculty_user',
          approved: true,
          enabled: true,
          mustChangePassword: false,
        },
      },
    }),
  );
}

async function mockHrSession(page: Page) {
  await mockSession(page);
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

test('shows the faculty module directory at the root', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'IT Faculty Management System' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Faculty modules' }).getByRole('link'),
  ).toHaveCount(12);
  await expect(page.getByRole('navigation', { name: 'Faculty modules' })).toHaveCSS(
    'display',
    'grid',
  );
  await expect(moduleLink(page, 'Inventory')).toHaveAttribute('href', '/inventory');
  await expect(moduleLink(page, 'HR')).toHaveAttribute('href', '/hr');
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
    await expect(page.getByRole('heading', { name: 'IT Faculty Management System' })).toHaveCount(
      0,
    );
    await expect(page.getByRole('navigation', { name: 'Faculty modules' })).toHaveCount(0);
    await expect(allModulesLink(page)).toHaveAttribute('href', '/');
  });
}

test('opens Inventory full width and keeps its account-specific landing page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockSession(page);
  await page.route('**/api/inventory/capabilities', (route) =>
    route.fulfill({
      json: {
        read: false,
        configure: false,
        postTransactions: false,
        dispose: false,
        requestRemoval: false,
        monitorWorkflows: false,
        hasEmployeeProfile: true,
      },
    }),
  );
  await page.route(/\/api\/inventory\/my-items(?:\?|$)/, (route) =>
    route.fulfill({ json: { linkedEmployee: true, items: [] } }),
  );

  await page.goto('/inventory');
  await expect(page).toHaveURL(/\/inventory\/my-items$/);
  await expect(page.getByText('You have no active assignments.')).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Inventory', exact: true });
  await expect(navigation.getByRole('link', { name: 'My Items' })).toHaveCSS(
    'background-color',
    'rgb(228, 240, 242)',
  );
  await expect(page.getByRole('navigation', { name: 'Faculty modules' })).toHaveCount(0);
  expect((await page.getByRole('main').boundingBox())?.width).toBeGreaterThan(1300);

  await allModulesLink(page).click();
  await expect(moduleLink(page, 'Inventory')).toBeVisible();
});

test('loads an HR deep link and fetches Attendance only when visited', async ({ page }) => {
  await mockHrSession(page);
  const chunks = await moduleChunks();
  const requestedPaths = new Set<string>();
  page.on('request', (request) => requestedPaths.add(new URL(request.url()).pathname));

  await page.goto('/hr/employees?search=Alex');
  await expect(page.getByRole('heading', { name: 'Employees', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Faculty modules' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'New employee' })).toHaveCSS(
    'justify-content',
    'center',
  );
  await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toHaveValue('Alex');
  expect(requestedPaths.has(chunks.hr)).toBe(true);
  expect(requestedPaths.has(chunks.attendance)).toBe(false);

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toHaveValue('Alex');
  await allModulesLink(page).click();
  await moduleLink(page, 'Attendance').click();
  await expect(page.getByRole('heading', { name: 'Attendance', exact: true })).toBeVisible();
  expect(requestedPaths.has(chunks.attendance)).toBe(true);

  await page.goBack();
  await expect(moduleLink(page, 'HR')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/hr\/employees\?search=Alex$/);
  await expect(page.getByRole('heading', { name: 'Employees', exact: true })).toBeVisible();
});

test('links to the directory while a module loads and after a load failure', async ({ page }) => {
  const { hr } = await moduleChunks();
  const chunk = Promise.withResolvers<void>();
  await page.route(`**${hr}`, async (route) => {
    await chunk.promise;
    await route.abort('connectionrefused');
  });
  try {
    await page.goto('/hr');
    await expect(page.getByRole('status')).toHaveText('Loading module...');
    await expect(allModulesLink(page)).toHaveAttribute('href', '/');
  } finally {
    chunk.resolve();
  }

  await expect(page.getByRole('alert')).toHaveText(/Unable to load this module/);
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await allModulesLink(page).click();
  await moduleLink(page, 'Attendance').click();

  await expect(page).toHaveURL(/\/attendance$/);
  await expect(page.getByRole('heading', { name: 'Attendance', exact: true })).toBeVisible();
});

test('shares form styles and scopes Facilities direction during navigation', async ({ page }) => {
  const signIn = page.getByRole('button', { name: 'Sign in', exact: true });
  const username = page.getByLabel(/^Username/);
  async function expectSharedControls() {
    await expect(signIn).toHaveCSS('background-color', 'rgb(29, 72, 88)');
    await expect(signIn).toHaveCSS('min-height', '40px');
    await expect(username).toHaveCSS('min-height', '40px');
    await expect(username).toHaveCSS('border-top-color', 'rgb(125, 146, 155)');
    await username.focus();
    await expect(username).toHaveCSS('outline-color', 'rgb(40, 120, 138)');
    await expect(username).toHaveCSS('outline-style', 'solid');
  }

  await page.goto('/facilities/rooms');
  await expectSharedControls();
  await page.getByRole('button', { name: 'Switch to Arabic' }).click();
  await expect(page.locator('.faculty-facilities')).toHaveAttribute('dir', 'rtl');
  await expect(allModulesLink(page)).toHaveCSS('direction', 'ltr');
  await allModulesLink(page).click();
  await expect(moduleLink(page, 'Attendance')).toHaveCSS('direction', 'ltr');

  await moduleLink(page, 'Administration').click();
  await expectSharedControls();

  await allModulesLink(page).click();
  await moduleLink(page, 'Inventory').click();
  await expectSharedControls();

  await allModulesLink(page).click();
  await moduleLink(page, 'HR').click();
  await expectSharedControls();

  await mockHrSession(page);
  await allModulesLink(page).click();
  await moduleLink(page, 'HR').click();
  await expect(page.getByRole('link', { name: 'New employee' })).toHaveCSS(
    'justify-content',
    'center',
  );
  await expect(allModulesLink(page)).toHaveCSS('direction', 'ltr');
});

test('preserves the shared Workflow and fallback routes', async ({ page }) => {
  await page.route('**/api/workflow/tasks', (route) => route.fulfill({ json: [] }));
  await page.goto('/');
  await moduleLink(page, 'Workflows').click();
  await expect(page).toHaveURL(/\/workflow\/tasks$/);
  await expect(page.getByText('No tasks are available.')).toBeVisible();
  await expect(allModulesLink(page)).toBeVisible();

  await page.route('**/api/workflow/tasks/task-id', (route) => route.fulfill({ status: 404 }));
  await page.goto('/workflow/tasks/task-id');
  await expect(page.getByRole('heading', { name: 'Review task' })).toBeVisible();
  await page.goto('/missing-module');
  await expect(page.getByRole('alert')).toHaveText('Page not found.');
  await allModulesLink(page).click();
  await expect(moduleLink(page, 'Workflows')).toBeVisible();
});
