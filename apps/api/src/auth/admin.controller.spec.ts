import { describe, it, expect, vi } from 'vitest';
import { AdminController } from './admin.controller.js';
import type { Database } from '@project/db';
import type { Auth } from './auth.provider.js';
describe('last usable administrator protection', () => {
  const keys = [
    'users:create',
    'users:approve',
    'users:assign-roles',
    'roles:update',
  ];
  async function check(
    people: unknown[],
    assignments: unknown[],
    grants: unknown[],
  ) {
    const from = vi
      .fn()
      .mockResolvedValueOnce(people)
      .mockResolvedValueOnce(assignments)
      .mockResolvedValueOnce(grants);
    const controller = new AdminController({} as Database, {} as Auth);
    // Exercise the transaction invariant independently of the database transport.
    return controller['protectAdministrator']({
      select: () => ({ from }),
    } as never);
  }
  it('rejects when the last administrator has been disabled', async () => {
    await expect(
      check(
        [
          {
            id: 'a',
            enabled: false,
            approved: true,
            mustChangePassword: false,
          },
        ],
        [{ userId: 'a', roleId: 'r' }],
        keys.map((permission) => ({ roleId: 'r', permission })),
      ),
    ).rejects.toThrow('last usable administrator');
  });
  it('rejects when removal leaves only a pending password change account', async () => {
    await expect(
      check(
        [{ id: 'a', enabled: true, approved: true, mustChangePassword: true }],
        [{ userId: 'a', roleId: 'r' }],
        keys.map((permission) => ({ roleId: 'r', permission })),
      ),
    ).rejects.toThrow();
  });
  it('rejects removal of the final administrative role', async () => {
    await expect(
      check(
        [{ id: 'a', enabled: true, approved: true, mustChangePassword: false }],
        [],
        [],
      ),
    ).rejects.toThrow();
  });
  it('accepts administrative permissions combined across multiple roles', async () => {
    await expect(
      check(
        [{ id: 'a', enabled: true, approved: true, mustChangePassword: false }],
        [
          { userId: 'a', roleId: 'r1' },
          { userId: 'a', roleId: 'r2' },
        ],
        keys.map((permission, i) => ({
          roleId: i % 2 ? 'r1' : 'r2',
          permission,
        })),
      ),
    ).resolves.toBeUndefined();
  });
});

describe('ACL request validation', () => {
  const controller = new AdminController({} as Database, {} as Auth);
  it('rejects invalid effects before accessing storage', async () => {
    await expect(
      controller.addAcl(
        'u',
        {
          resourceType: 'users',
          resourceId: 'r',
          permission: 'users:read',
          effect: 'permit',
        },
        {} as never,
      ),
    ).rejects.toThrow('effect must be allow or deny');
  });
  it('rejects mismatched permission and resource types', async () => {
    await expect(
      controller.addAcl(
        'u',
        {
          resourceType: 'users',
          resourceId: 'r',
          permission: 'roles:update',
          effect: 'allow',
        },
        {} as never,
      ),
    ).rejects.toThrow('mismatched permission');
  });
  it('rejects resource types with no registered backend resolver', async () => {
    await expect(
      controller.addAcl(
        'u',
        {
          resourceType: 'tasks',
          resourceId: 'r',
          permission: 'tasks:update',
          effect: 'deny',
        },
        {} as never,
      ),
    ).rejects.toThrow('Unsupported resource');
  });
  it('rejects missing resource identifiers', async () => {
    await expect(
      controller.addAcl(
        'u',
        { resourceType: 'users', permission: 'users:read', effect: 'allow' },
        {} as never,
      ),
    ).rejects.toThrow('resourceId');
  });
});
