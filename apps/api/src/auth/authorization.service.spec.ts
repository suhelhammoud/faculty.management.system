import { describe, it, expect } from 'vitest';
import { evaluatePermission } from './authorization.service.js';
describe('authorization precedence', () => {
  it('denies by default', () =>
    expect(evaluatePermission([], false)).toBe(false));
  it('uses role permissions when there is no ACL', () =>
    expect(evaluatePermission([], true)).toBe(true));
  it('allows an ACL grant without a role grant', () =>
    expect(evaluatePermission(['allow'], false)).toBe(true));
  it('explicit deny overrides ACL and role grants', () =>
    expect(evaluatePermission(['allow', 'deny'], true)).toBe(false));
});
