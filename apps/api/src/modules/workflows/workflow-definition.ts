import type { PermissionKey } from '@project/authorization';
import type { Database } from '@project/db';
import type { workflowEvents, workflowInstances, workflowTasks } from '@project/db/schema';

export type WorkflowTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type WorkflowReader = Database | WorkflowTransaction;
export type WorkflowInstance = typeof workflowInstances.$inferSelect;
export type WorkflowTask = typeof workflowTasks.$inferSelect;
export type WorkflowEvent = typeof workflowEvents.$inferSelect;

export interface WorkflowSubject {
  module: string;
  type: string;
  id: string;
}

export type Transition<Step extends string = string> =
  { next: Step } | { finish: 'completed' | 'rejected' | 'cancelled' };

export interface WorkflowDefinition<Step extends string = string> {
  key: `${string}.${string}`;
  version: number;
  title: string;
  description: string;
  initialStep: Step;
  steps: Record<
    Step,
    {
      title: string;
      instructions: string;
      eligible: { permission: PermissionKey } | { requester: true };
      actions: Readonly<Record<string, Transition<Step>>>;
    }
  >;
}

export interface WorkflowAccess {
  db: WorkflowReader;
  actorId: string;
  subject: WorkflowSubject;
  instance: WorkflowInstance;
}

export interface WorkflowActionAccess extends WorkflowAccess {
  task: WorkflowTask;
  action: string;
}

export interface WorkflowAction extends WorkflowActionAccess {
  db: WorkflowTransaction;
  comment?: string;
  input: unknown;
  transition: Transition;
}

export interface WorkflowRegistration {
  definition: WorkflowDefinition;
  subjectType: string;
  active?: boolean;
  canView(context: WorkflowAccess): Promise<boolean>;
  requester(context: WorkflowAccess): Promise<string | null>;
  canAct?(context: WorkflowActionAccess): Promise<boolean>;
  canViewEvent?(context: WorkflowAccess, event: WorkflowEvent): Promise<boolean>;
  canViewComment?(context: WorkflowAccess, event: WorkflowEvent): Promise<boolean>;
  assign?(context: WorkflowAccess, step: string): Promise<string | null>;
  apply(context: WorkflowAction): Promise<{ domainReference?: string } | void>;
}
