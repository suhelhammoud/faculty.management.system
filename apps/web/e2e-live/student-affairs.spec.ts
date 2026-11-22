import { expect, test, type Browser } from '@playwright/test';

async function signIn(browser: Browser, origin: string, username: string, password: string) {
  const page = await browser.newPage();
  await page.goto(`${origin}/student-affairs`);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  return page;
}

test('seeded dean grant permits a year change until it is revoked', async ({
  browser,
  baseURL,
}) => {
  const password = process.env.SEED_USER_PASSWORD;
  if (!baseURL || !password) throw new Error('Start the pilot harness before running live tests');

  const admin = await signIn(browser, baseURL, 'sta_admin', password);
  await admin.getByLabel('Search by name or academic ID').fill('DEMO-STA-002');
  await admin.getByRole('button', { name: 'Search' }).click();
  await admin.getByRole('row').filter({ hasText: 'DEMO-STA-002' }).getByRole('link').click();
  await expect(admin.getByText('No active dean grant.')).toBeVisible();

  const dean = await signIn(browser, baseURL, 'sta_dean', password);
  await expect(dean.getByRole('link', { name: 'Students' })).toHaveCount(0);
  await dean.getByLabel('Recipient').selectOption('seed-sta_admin');
  const day = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  await dean.getByLabel('Expiry date and time').fill(`${day}T12:00`);
  await dean.getByRole('button', { name: 'Issue grant' }).click();
  await dean.getByRole('button', { name: 'Confirm grant' }).click();
  await expect(dean.getByText('Active', { exact: true })).toBeVisible();

  await admin.getByRole('button', { name: 'Refresh grant status' }).click();
  await admin.getByLabel('Destination year').selectOption('3');
  await admin.getByRole('button', { name: 'Change study year' }).click();
  await admin.getByRole('button', { name: 'Confirm year change' }).click();
  await expect(admin.getByText('Study year updated.')).toBeVisible();

  await dean.getByRole('button', { name: 'Revoke grant' }).click();
  await dean.getByRole('button', { name: 'Confirm revocation' }).click();
  await expect(dean.getByText('Revoked', { exact: true })).toBeVisible();

  const api = process.env.VITE_API_URL;
  const id = new URL(admin.url()).pathname.split('/').at(-1);
  const profile = `${api}/api/student-affairs/students/${id}`;
  const current = await admin.request.get(profile);
  expect(current.ok()).toBe(true);
  const { revision } = await current.json();
  const denied = await admin.request.put(`${profile}/current-study-year`, {
    headers: { Origin: baseURL },
    data: { currentStudyYear: 4, expectedRevision: revision },
  });
  expect(denied.status()).toBe(403);
  await admin.getByRole('button', { name: 'Refresh grant status' }).click();
  await expect(admin.getByText('No active dean grant.')).toBeVisible();
});
