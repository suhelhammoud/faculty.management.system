import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { WorkflowTask } from '../../workflows/WorkflowPages';
import { useLanguage } from '../lib/i18n';
import { roomPatch, whole } from '../pages/write';

const capabilities = {
  read: false,
  configure: false,
  postTransactions: false,
  dispose: false,
  requestRemoval: false,
  monitorWorkflows: false,
  hasEmployeeProfile: true,
};
const response = (body: unknown, status = 200) => Response.json(body, { status });
function mount(path: string, fixtures: Record<string, unknown> = {}) {
  const fetchMock = vi.fn(async (input: string, options?: RequestInit) => {
    const { pathname } = new URL(input);
    const routes = {
      '/api/auth/get-session': {
        user: {
          id: 'staff-one',
          name: 'Staff One',
          approved: true,
          enabled: true,
          mustChangePassword: false,
        },
      },
      '/api/inventory/capabilities': capabilities,
      ...fixtures,
    } as Record<string, unknown>;
    const value = routes[pathname];
    if (typeof value === 'function') return await value(options);
    return value === undefined ? response({}, 404) : response(value);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/inventory/*" element={<App />} />
        <Route path="/workflow/tasks/:id" element={<WorkflowTask />} />
      </Routes>
    </MemoryRouter>,
  );
  return fetchMock;
}
beforeEach(() => {
  localStorage.clear();
  useLanguage.getState().change('en');
});
afterEach(() => vi.unstubAllGlobals());

const instance = {
  id: 'instance',
  subjectId: 'proposal',
  subjectModule: 'inventory',
  subjectType: 'removal-request',
  status: 'running',
};
const item = {
  assetId: 'asset-1',
  tag: 'INV-1',
  name: 'Projector',
  reason: 'Broken',
  revision: 1,
  condition: 'malfunctioning',
};
const proposal = { instanceId: 'instance', currentRevision: 1, items: [item], decision: null };
function task(step: string, actions: string[]) {
  return {
    '/api/workflow/tasks/task': { step, actions, instance, status: 'pending', id: 'task' },
    '/api/inventory/workflow/removal-requests/proposal': proposal,
  };
}

describe('Inventory workspace', () => {
  it('lands linked staff on their items and persists the Arabic layout', async () => {
    const fetchMock = mount('/inventory', {
      '/api/inventory/my-items': {
        linkedEmployee: true,
        items: [
          {
            id: 'asset-1',
            tag: 'INV-1',
            name: 'Projector',
            room: null,
            condition: 'serviceable',
            assignedAt: '2025-01-01T00:00:00Z',
          },
        ],
      },
    });
    expect(await screen.findByText('INV-1')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Assets' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'العربية' }));
    const heading = await screen.findByRole('heading', { name: 'عهدتي' });
    expect(heading.closest('.faculty-inventory')).toHaveAttribute('dir', 'rtl');
    expect(localStorage.getItem('faculty-inventory-language')).toBe('ar');
    expect(fetchMock.mock.calls.some(([url]) => url.includes('/api/inventory/assets'))).toBe(false);
  });

  it('distinguishes missing employee links', async () => {
    mount('/inventory/my-items', {
      '/api/inventory/my-items': { linkedEmployee: false, items: [] },
    });
    expect(
      await screen.findByText('No HR employee profile is linked to this account.'),
    ).toBeInTheDocument();
  });

  it('posts an asset issue from the register with the prefilled asset and source', async () => {
    const post = vi.fn(() => response({ id: 'posted' }, 201));
    mount('/inventory/assets', {
      '/api/inventory/capabilities': { ...capabilities, read: true, postTransactions: true },
      '/api/inventory/assets': [
        {
          asset: {
            id: 'a1',
            tag: 'INV-1',
            name: 'Projector',
            status: 'active',
            roomId: 'store',
            revision: 4,
          },
          custody: { sharedAccountId: 'custodian' },
          sharedAccount: 'Storage team',
          room: 'Main store',
          isStorage: true,
        },
      ],
      '/api/inventory/rooms': [],
      '/api/inventory/storage': [],
      '/api/inventory/shared-accounts': [],
      '/api/inventory/employees': [{ id: 'e1', name: 'Employee One' }],
      '/api/inventory/transactions': post,
      '/api/inventory/transactions/posted': {
        name: 'Issue projector',
        type: 'asset-issue',
        eventDate: '2026-11-20',
        recordedAt: '2026-11-20T12:00:00Z',
        labels: { employees: [], rooms: [], sharedAccounts: [] },
        items: [],
      },
    });
    fireEvent.click(await screen.findByRole('link', { name: 'Asset issue' }));
    const source = screen.getByLabelText('Source storage');
    expect(source).toHaveValue('store');
    expect(
      within(source).getByRole('option', { name: 'Main store', selected: true }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Asset')).toHaveValue('a1');
    await screen.findByRole('option', { name: 'Employee One' });
    fireEvent.change(screen.getByLabelText('Employee'), { target: { value: 'e1' } });
    expect(screen.getByText('Resulting custodian').nextElementSibling).toHaveTextContent(
      'Employee One',
    );
    expect(screen.getByText('Resulting room').nextElementSibling).toHaveTextContent('Main store');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Issue projector' } });
    fireEvent.change(screen.getByLabelText('Event date'), { target: { value: '2026-11-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post transaction' }));
    await screen.findByRole('heading', { name: 'Issue projector' });
    expect(post).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        body: JSON.stringify({
          type: 'asset-issue',
          name: 'Issue projector',
          eventDate: '2026-11-20',
          items: [{ assetId: 'a1', expectedRevision: 4 }],
          sourceRoomId: 'store',
          recipient: { kind: 'employee', id: 'e1' },
        }),
      }),
    );
  });

  it('refreshes a stock issue preview after a conflict and keeps the draft for correction', async () => {
    const item = { id: 'paper', code: 'PAPER', name: 'Copy paper', unit: 'ream' };
    let quantity = 10;
    const post = vi.fn(() => {
      quantity = 2;
      return response({ message: 'Insufficient stock' }, 409);
    });
    mount('/inventory/stock', {
      '/api/inventory/capabilities': { ...capabilities, read: true, postTransactions: true },
      '/api/inventory/stock': () =>
        response([{ roomId: 'store', room: 'Main store', item, quantity }]),
      '/api/inventory/rooms': [],
      '/api/inventory/storage': [],
      '/api/inventory/consumables': [],
      '/api/inventory/employees': [{ id: 'e1', name: 'Employee One' }],
      '/api/inventory/transactions': post,
    });
    fireEvent.click(await screen.findByRole('link', { name: 'Consumable issue' }));
    expect(screen.getByLabelText('Consumable')).toHaveValue('paper');
    expect(screen.getByLabelText('Source storage')).toHaveValue('store');
    await screen.findByText(/Available stock.*10 Ream/);
    await screen.findByRole('option', { name: 'Employee One' });
    fireEvent.change(screen.getByLabelText('Recipient'), { target: { value: 'e1' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Issue paper' } });
    fireEvent.change(screen.getByLabelText('Event date'), { target: { value: '2026-11-20' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '4' } });
    expect(screen.getByText(/Expected remaining stock.*6 Ream/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Post transaction' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Insufficient stock');
    await screen.findByText(/Available stock.*2 Ream/);
    expect(screen.getByLabelText('Quantity')).toHaveValue('4');
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '1' } });
    expect(screen.getByText(/Expected remaining stock.*1 Ream/)).toBeInTheDocument();
  });

  it('uses the same key when retrying a review action after a network failure', async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(response({ instanceId: 'instance' }));
    mount('/inventory/workflow/tasks/task', {
      ...task('review', ['forward', 'return', 'reject']),
      '/api/workflow/tasks/task/actions': submit,
      '/api/workflow/instances/instance': { ...instance, history: [], currentTaskId: null },
    });
    const button = await screen.findByRole('button', { name: 'Submit action' });
    fireEvent.click(button);
    await screen.findByRole('alert');
    fireEvent.click(button);
    await screen.findByRole('heading', { name: 'Workflow history' });
    expect(submit.mock.calls[0][0].headers['Idempotency-Key']).toBe(
      submit.mock.calls[1][0].headers['Idempotency-Key'],
    );
    expect(JSON.parse(submit.mock.calls[1][0].body)).toEqual({ action: 'forward' });
  });

  it('prefills a revision from the current proposal', async () => {
    mount('/inventory/workflow/tasks/task', {
      ...task('revise', ['resubmit']),
      '/api/inventory/workflow/assets': [
        { id: item.assetId, tag: item.tag, name: item.name, status: 'active' },
      ],
    });
    expect(await screen.findByRole('heading', { name: 'Revise proposal' })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Broken')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resubmit proposal' })).toBeEnabled();
  });

  it('confirms committee withdrawal and refreshes the workflow history', async () => {
    let withdrawn = false;
    const submit = vi.fn(() => {
      withdrawn = true;
      return response({ instanceId: 'instance', status: 'cancelled', taskId: null });
    });
    mount('/inventory/workflow/instances/instance', {
      '/api/workflow/instances/instance': () =>
        response({
          ...instance,
          status: withdrawn ? 'cancelled' : 'running',
          currentStep: withdrawn ? null : 'committee-decision',
          currentTaskId: withdrawn ? null : 'task',
          canWithdraw: !withdrawn,
          history: withdrawn
            ? [{ id: 'event', action: 'withdraw', actorId: 'staff-one', occurredAt: '2026-11-18' }]
            : [],
        }),
      '/api/workflow/instances/instance/withdraw': submit,
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm withdrawal' }));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: /committee has not made a decision/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Comment' }), {
      target: { value: '  Duplicate request  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm withdrawal' }));
    expect(await screen.findByText('Withdrawn')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Withdraw request' })).not.toBeInTheDocument();
    expect(submit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ comment: 'Duplicate request', input: { committeeUndecided: true } }),
        headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
      }),
    );
  });

  it('preserves the return action after a stale committee decision in Arabic', async () => {
    useLanguage.getState().change('ar');
    const submit = vi
      .fn()
      .mockResolvedValue(response({ message: 'An asset changed during review' }, 409));
    mount('/inventory/workflow/tasks/task', {
      ...task('committee-decision', ['record-decision', 'return']),
      '/api/workflow/tasks/task/actions': submit,
    });
    fireEvent.change(await screen.findByLabelText('اسم القرار'), {
      target: { value: 'Committee' },
    });
    fireEvent.change(screen.getByLabelText('المرجع'), { target: { value: 'R1' } });
    fireEvent.change(screen.getByLabelText('تاريخ القرار'), { target: { value: '2025-01-03' } });
    fireEvent.change(screen.getByLabelText('النتيجة'), { target: { value: 'approved-for-waste' } });
    fireEvent.change(screen.getByLabelText('السبب'), { target: { value: 'Broken' } });
    fireEvent.click(screen.getByRole('button', { name: 'إرسال الإجراء' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('أعد الاقتراح للتعديل');
    fireEvent.change(screen.getByLabelText('الإجراء'), { target: { value: 'return' } });
    await waitFor(() => expect(screen.queryByLabelText('اسم القرار')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'إرسال الإجراء' })).toBeDisabled();
  });

  it('resolves the old shell task link to the localized Inventory task', async () => {
    useLanguage.getState().change('ar');
    mount('/workflow/tasks/task', task('review', ['forward', 'return', 'reject']));
    const heading = await screen.findByRole('heading', { name: 'مراجعة الطلب' });
    expect(heading.closest('.faculty-inventory')).toHaveAttribute('dir', 'rtl');
  });

  it('opens and closes an RTL asset detail dialog with the keyboard', async () => {
    useLanguage.getState().change('ar');
    mount('/inventory/assets', {
      '/api/inventory/capabilities': { ...capabilities, read: true },
      '/api/inventory/assets': [
        {
          asset: {
            id: 'a1',
            tag: 'INV-1',
            name: 'Projector',
            status: 'active',
            condition: 'serviceable',
          },
          custody: null,
        },
      ],
      '/api/inventory/rooms': [],
      '/api/inventory/employees': [],
      '/api/inventory/shared-accounts': [],
    });
    const trigger = await screen.findByRole('button', { name: 'تفاصيل الأصل' });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('dir', 'rtl');
    expect(dialog.closest('.faculty-inventory')).not.toBeNull();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('encodes the three room operations and accepts Arabic whole quantities', () => {
    expect(roomPatch('keep', 'a')).toEqual({});
    expect(roomPatch('change', 'a')).toEqual({ destinationRoomId: 'a' });
    expect(roomPatch('clear', 'a')).toEqual({ destinationRoomId: null });
    expect(whole('١٢')).toBe(12);
    expect(whole('-۱۲')).toBe(-12);
  });
});
