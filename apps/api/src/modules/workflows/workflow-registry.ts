import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PERMISSION_CATALOG } from '@project/authorization';
import type { WorkflowRegistration } from './workflow-definition.js';

@Injectable()
export class WorkflowRegistry implements OnApplicationBootstrap {
  private readonly versions = new Map<string, WorkflowRegistration>();
  private readonly active = new Map<string, WorkflowRegistration>();
  private ready = false;

  register(registration: WorkflowRegistration) {
    if (this.ready) throw new Error('Workflow registration has closed');
    const { key, version } = registration.definition;
    const id = `${key}@${version}`;
    if (this.versions.has(id)) throw new Error(`Duplicate workflow definition ${id}`);
    this.versions.set(id, registration);
  }

  onApplicationBootstrap() {
    const permissions = new Set<string>(PERMISSION_CATALOG.map(({ key }) => key));
    for (const registration of this.versions.values()) {
      const { key, version, steps, initialStep } = registration.definition;
      if (
        !/^[a-z][a-z0-9-]*\.[a-z][a-z0-9.-]*$/.test(key) ||
        !Number.isSafeInteger(version) ||
        version < 1
      ) {
        throw new Error(`Invalid workflow key or version ${key}@${version}`);
      }
      if (!Object.hasOwn(steps, initialStep))
        throw new Error(`Invalid initial step for ${key}@${version}`);
      for (const [step, { eligible, actions, withdraw }] of Object.entries(steps)) {
        if ('permission' in eligible && !permissions.has(eligible.permission)) {
          throw new Error(`Unknown permission for ${key}@${version}/${step}`);
        }
        if (withdraw && 'permission' in withdraw && !permissions.has(withdraw.permission)) {
          throw new Error(`Unknown withdrawal permission for ${key}@${version}/${step}`);
        }
        if (!Object.keys(actions).length)
          throw new Error(`No actions for ${key}@${version}/${step}`);
        for (const transition of Object.values(actions)) {
          if ('next' in transition && !Object.hasOwn(steps, transition.next)) {
            throw new Error(`Unknown transition target for ${key}@${version}/${step}`);
          }
        }
      }
      if (registration.active) {
        if (this.active.has(key)) throw new Error(`Multiple active versions for ${key}`);
        this.active.set(key, registration);
      }
    }
    this.ready = true;
  }

  current(key: string) {
    return this.active.get(key);
  }

  get(key: string, version: number) {
    return this.versions.get(`${key}@${version}`);
  }
}
