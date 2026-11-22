import { expect, test } from '@playwright/test';
import type { DesignDocument } from '@project/contracts/workflow';
test('edits a shared design and exports as a viewer', async ({ page }) => {
  let edit = true;
  let doc: DesignDocument = {
    title: 'Asset removal review',
    description: '',
    version: 1,
    key: 'inventory.removal',
    initialStep: 'review',
    steps: [
      {
        id: 'review',
        key: 'review',
        title: 'Review',
        instructions: '',
        x: 30,
        y: 50,
        eligible: { requester: true },
        actions: [{ key: 'approve', target: { finish: 'completed' } }],
      },
    ],
  };
  let revision = 1;
  await page.route('**/api/workflow/designer/**', async (route) => {
    const path = new URL(route.request().url()).pathname.split('/designer/')[1];
    const method = route.request().method();
    if (path === 'drafts' && method === 'POST') doc = route.request().postDataJSON();
    if (method === 'PUT') {
      doc = route.request().postDataJSON().document;
      revision++;
    }
    const json =
      path === 'capabilities'
        ? { canRead: true, canEdit: edit }
        : path === 'catalog'
          ? { permissions: [], templates: [doc] }
          : path === 'drafts' && method === 'GET'
            ? []
            : path.endsWith('/export')
              ? { key: doc.key }
              : { id: 'example', document: doc, revision };
    await route.fulfill({ json });
  });
  await page.goto('/workflow/designer');
  await page.getByLabel('Starting workflow').selectOption('inventory.removal');
  await page.getByRole('button', { name: 'Create draft' }).click();
  await page.getByLabel('Step title', { exact: true }).fill('Faculty review');
  await page.getByRole('button', { name: 'Add action' }).click();
  await page.getByLabel('Action key').last().fill('return');
  await page.getByLabel('Destination').last().selectOption('step:review');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
  edit = false;
  await page.reload();
  await expect(page.getByLabel('Step title', { exact: true })).toHaveValue('Faculty review');
  await expect(page.getByLabel('Step title', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Destination').last()).toHaveValue('step:review');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export definition' }).click();
  expect((await download).suggestedFilename()).toBe('inventory.removal.json');
});
