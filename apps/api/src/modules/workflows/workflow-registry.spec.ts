import { PERMISSION } from '@project/authorization';
import { describe, expect, it } from 'vitest';
import type { WorkflowRegistration } from './workflow-definition.js';
import { WorkflowRegistry } from './workflow-registry.js';

function registration(version: number, active: boolean): WorkflowRegistration {
  return {
    definition: {
      key: 'exams.approval',
      version,
      title: 'Results',
      description: 'Results approval',
      initialStep: 'review',
      steps: {
        review: {
          title: 'Review',
          instructions: 'Review results',
          eligible: { permission: PERMISSION.workflow.monitor },
          actions: { approve: { finish: 'completed' } },
        },
      },
    },
    subjectType: 'results',
    active,
    canView: async () => true,
    requester: async () => null,
    apply: async () => undefined,
  };
}

describe('WorkflowRegistry', () => {
  it('preserves the original definition and handler when a new version is active', () => {
    const registry = new WorkflowRegistry();
    const original = registration(1, false);
    const current = registration(2, true);
    registry.register(original);
    registry.register(current);
    registry.onApplicationBootstrap();
    expect(registry.current('exams.approval')).toBe(current);
    expect(registry.get('exams.approval', 1)).toBe(original);
  });

  it('rejects duplicate versions and undefined transition targets', () => {
    const registry = new WorkflowRegistry();
    const draft = registration(1, true);
    draft.definition.steps.review.actions = { approve: { next: 'missing' } };
    registry.register(draft);
    expect(() => registry.register(draft)).toThrow('Duplicate workflow definition');
    expect(() => registry.onApplicationBootstrap()).toThrow('Unknown transition target');
  });
  it('requires an explicit match rule and a resolver for department routing', () => {
    const missingMatch = registration(1, true);
    Object.assign(missingMatch.definition.steps.review.eligible, { position: 'dean' });
    const matchRegistry = new WorkflowRegistry();
    matchRegistry.register(missingMatch);
    expect(() => matchRegistry.onApplicationBootstrap()).toThrow('Invalid combined eligibility');

    const department = registration(1, true);
    department.definition.steps.review.eligible = {
      position: { byDepartment: { 'software-engineering': 'head-software-engineering' } },
    };
    const departmentRegistry = new WorkflowRegistry();
    departmentRegistry.register(department);
    expect(() => departmentRegistry.onApplicationBootstrap()).toThrow(
      'Missing department resolver',
    );
  });
});
