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
  return page.locator('main header').getByRole('link', { name: /^(All modules|جميع الوحدات)$/ });
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
      await expect(link).toHaveAttribute('dir', width === 320 ? 'rtl' : 'ltr');
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

test('shares form styles and carries Arabic through bilingual module navigation', async ({
  page,
}) => {
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
  await expect(allModulesLink(page)).toHaveCSS('direction', 'rtl');
  await allModulesLink(page).click();
  await expect(moduleLink(page, 'Attendance')).toHaveCSS('direction', 'ltr');

  await moduleLink(page, 'Administration').click();
  await expectSharedControls();

  await allModulesLink(page).click();
  for (const module of ['Inventory', 'Student Affairs', 'HR']) {
    await moduleLink(page, module).click();
    await expect(page.locator('main > section')).toHaveAttribute('dir', 'rtl');
    await page.reload();
    await expect(page.locator('main > section')).toHaveAttribute('dir', 'rtl');
    if (module !== 'HR') await allModulesLink(page).click();
  }
  await page.getByRole('button', { name: 'التبديل إلى الإنجليزية', exact: true }).click();
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
  await page.route('**/api/workflow/tasks', (route) =>
    route.fulfill({ json: { records: [], nextCursor: null } }),
  );
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

test('opens a Student Affairs profile directly on a phone and switches to Arabic RTL', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSession(page);
  await page.route('**/api/student-affairs/capabilities', (route) =>
    route.fulfill({
      json: { read: true, administer: false, grantPromotions: false, assignedStudyYears: [1] },
    }),
  );
  await page.route('**/api/student-affairs/students/demo-student', (route) =>
    route.fulfill({
      json: {
        studentId: 'demo-student',
        academicId: 'DEMO-STA-002',
        firstName: 'ليلى',
        fatherName: 'خالد',
        lastName: 'أحمد',
        currentStudyYear: 2,
      },
    }),
  );
  await page.goto('/student-affairs/students/demo-student');
  await expect(page.getByRole('heading', { name: 'ليلى خالد أحمد' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit profile' })).toHaveCount(0);
  await page.getByRole('button', { name: 'العربية' }).click();
  await expect(page.getByRole('heading', { name: 'شؤون الطلاب' })).toBeVisible();
  await expect(page.locator('.faculty-student-affairs')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('link', { name: 'السجلات السنوية' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.reload();
  await expect(page.locator('.faculty-student-affairs')).toHaveAttribute('dir', 'rtl');
});

test('assigns a holder to the existing Dean position from its row', async ({ page }) => {
  await mockSession(page);
  await page.route('**/api/admin/{users,roles,permissions}', (route) =>
    route.fulfill({ json: [] }),
  );

  const base = '**/api/admin/faculty-positions';
  const holder = { userId: 'colleague', name: 'Faculty Colleague', username: 'colleague' };
  const appointment = {
    ...holder,
    id: 'appointment',
    appointmentDate: '2026-10-19',
    startedAt: '2026-11-22T12:00:00.000Z',
    endedAt: null,
  };
  let currentAppointment: typeof appointment | null = null;
  const dean = { id: 'dean', code: 'dean', titleEn: 'Dean', titleAr: null, departmentCode: null };

  await page.route(base, (route) =>
    route.fulfill({
      json: {
        canManage: true,
        positions: [
          { ...dean, currentAppointment },
          {
            ...dean,
            id: 'head-registry',
            code: 'head-registry',
            titleEn: 'Head of the Registry',
            currentAppointment: null,
          },
        ],
      },
    }),
  );
  await page.route(`${base}/eligible-holders`, (route) => route.fulfill({ json: [holder] }));
  await page.route(`${base}/dean/appointments`, (route) =>
    route.fulfill({ json: currentAppointment ? [currentAppointment] : [] }),
  );
  await page.route(`${base}/dean/holder`, (route) => {
    expect(route.request().method()).toBe('PUT');
    expect(route.request().postDataJSON()).toEqual({
      userId: holder.userId,
      expectedAppointmentId: null,
      appointmentDate: appointment.appointmentDate,
    });
    currentAppointment = appointment;
    return route.fulfill({ json: { appointmentId: appointment.id } });
  });

  await page.goto('/admin');
  await page.getByRole('button', { name: 'Faculty Positions', exact: true }).click();
  const row = page.getByRole('row').filter({
    has: page.getByRole('button', { name: /^(Assign|Manage) holder for Dean$/ }),
  });
  await expect(row).toContainText('Vacant');
  const assign = row.getByRole('button', { name: 'Assign holder for Dean' });
  await expect(assign).toHaveAttribute('aria-expanded', 'false');
  await assign.click();
  await expect(assign).toHaveAttribute('aria-expanded', 'true');

  const details = row
    .locator('xpath=following-sibling::tr[1]')
    .getByRole('region', { name: 'Dean' });
  await expect(details.getByText('No appointments yet.')).toBeVisible();
  await details.getByLabel('Appoint user').selectOption(holder.userId);
  const date = details.getByRole('textbox', { name: 'Appointment date' });
  await expect(date).toHaveValue(/^\d{2}\/\d{2}\/\d{4}$/);
  await date.fill('19/10/2026');
  await details.getByRole('button', { name: 'Save holder' }).click();
  await expect(row).toContainText(holder.name);
  await expect(row).toContainText('Appointed 19/10/2026');
  await expect(details.getByRole('row').filter({ hasText: 'Current' })).toContainText('19/10/2026');
  const manage = row.getByRole('button', { name: 'Manage holder for Dean' });
  await expect(manage).toHaveAttribute('aria-expanded', 'true');
  await manage.click();
  await expect(details).toHaveCount(0);
});

test('shows only appointment history to read-only faculty position viewers', async ({ page }) => {
  await mockSession(page);
  await page.route('**/api/admin/{users,roles,permissions}', (route) =>
    route.fulfill({ json: [] }),
  );
  const base = '**/api/admin/faculty-positions';
  await page.route(base, (route) =>
    route.fulfill({
      json: {
        canManage: false,
        positions: [
          {
            id: 'dean',
            code: 'dean',
            titleEn: 'Dean',
            titleAr: null,
            departmentCode: null,
            currentAppointment: null,
          },
        ],
      },
    }),
  );
  await page.route(`${base}/dean/appointments`, (route) => route.fulfill({ json: [] }));

  await page.goto('/admin');
  await page.getByRole('button', { name: 'Faculty Positions', exact: true }).click();
  await page.getByRole('button', { name: 'View details for Dean' }).click();
  const details = page.getByRole('region', { name: 'Dean' });
  await expect(details.getByRole('heading', { name: 'Appointment history' })).toBeVisible();
  await expect(details.getByText('No appointments yet.')).toBeVisible();
  await expect(details.getByLabel('Appoint user')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /^(Assign holder|Manage holder|Add position)/ }),
  ).toHaveCount(0);
});
