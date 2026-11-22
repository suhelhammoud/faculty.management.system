export type WorkflowInstanceStatus = 'running' | 'completed' | 'rejected' | 'cancelled';
export type WorkflowTaskStatus = 'pending' | 'completed' | 'cancelled';

/** Serialized workflow instance as returned by the shared HTTP API. */
export interface WorkflowInstance {
  id: string;
  definitionKey: string;
  definitionVersion: number;
  subjectModule: string;
  subjectType: string;
  subjectId: string;
  startedBy: string;
  status: WorkflowInstanceStatus;
  currentStep: string | null;
  startedAt: string;
  lastActivityAt: string;
  completedAt: string | null;
  title: string;
  description: string;
}

export interface WorkflowTask {
  id: string;
  instanceId: string;
  step: string;
  assignedUserId: string | null;
  status: WorkflowTaskStatus;
  openedAt: string;
  completedAt: string | null;
  instance: WorkflowInstance;
  title: string;
  instructions: string;
  /** Only actions the caller can submit on this task. */
  actions: string[];
}

export interface WorkflowHistoryEvent {
  id: string;
  taskId: string | null;
  actorId: string;
  actedAsPosition?: { code: string; appointmentId: string };
  action: string;
  occurredAt: string;
  comment: string | null;
}

export interface WorkflowInstanceDetail extends WorkflowInstance {
  currentTaskId: string | null;
  canWithdraw: boolean;
  history: WorkflowHistoryEvent[];
}

export interface WorkflowActionResult {
  instanceId: string;
  taskId: string | null;
  status: WorkflowInstanceStatus;
}

export interface WorkflowPage<T> {
  records: T[];
  nextCursor: string | null;
}

export interface DesignRule {
  permission?: string;
  requester?: true;
  position?: string | { byDepartment: Record<string, string> };
  match?: 'any' | 'all';
}
export type DesignTransition =
  { next: string } | { finish: 'completed' | 'rejected' | 'cancelled' };
export interface DesignStep {
  id: string;
  key: string;
  title: string;
  instructions: string;
  eligible: DesignRule;
  withdraw?: DesignRule;
  actions: { key: string; target: DesignTransition }[];
  x: number;
  y: number;
}
export interface DesignDocument {
  title: string;
  description: string;
  key: string;
  version: number;
  initialStep: string;
  steps: DesignStep[];
}
export interface WorkflowDraft {
  id: string;
  revision: number;
  document: DesignDocument;
  updatedAt: string;
  updatedBy: string;
}
