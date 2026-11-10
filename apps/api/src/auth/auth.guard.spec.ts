import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { Auth } from './auth.provider.js';
import { AuthGuard } from './auth.guard.js';
import type { AuthorizationService } from './authorization.service.js';
describe('protected endpoints', () => {
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ headers: {}, params: { id: 'target' } }),
    }),
  } as unknown as ExecutionContext;
  function setup(loggedIn: boolean, allowed: boolean, policy = true) {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) =>
        key === 'auth:public'
          ? false
          : policy
            ? {
                permission: 'users:approve',
                resourceType: 'users',
                idParam: 'id',
              }
            : undefined,
      ),
    } as unknown as Reflector;
    const auth = {
      api: {
        getSession: vi
          .fn()
          .mockResolvedValue(loggedIn ? { user: { id: 'actor' } } : null),
      },
    } as unknown as Auth;
    const can = vi.fn().mockResolvedValue(allowed);
    return {
      guard: new AuthGuard(reflector, auth, {
        can,
      } as unknown as AuthorizationService),
      can,
    };
  }
  it('rejects anonymous callers', async () => {
    await expect(
      setup(false, true).guard.canActivate(context),
    ).rejects.toThrow();
  });
  it('rejects endpoints without an explicit policy', async () => {
    await expect(
      setup(true, true, false).guard.canActivate(context),
    ).rejects.toThrow();
  });
  it('passes the resource to authorization', async () => {
    const { guard, can } = setup(true, true);
    expect(await guard.canActivate(context)).toBe(true);
    expect(can).toHaveBeenCalledWith('actor', 'users:approve', {
      type: 'users',
      id: 'target',
    });
  });
  it('enforces a negative authorization result', async () => {
    await expect(
      setup(true, false).guard.canActivate(context),
    ).rejects.toThrow();
  });
});
