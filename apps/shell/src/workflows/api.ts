const base = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export type Status = 'running' | 'completed' | 'rejected' | 'cancelled';

export interface Instance {
  id: string;
  title: string;
  description: string;
  subjectModule: string;
  subjectType: string;
  subjectId: string;
  status: Status;
  currentStep: string | null;
  startedAt: string;
  lastActivityAt: string;
}

export interface Task {
  id: string;
  title: string;
  instructions: string;
  step: string;
  status: string;
  actions: string[];
  instance: Instance;
}

export interface Detail extends Instance {
  currentTaskId: string | null;
  history: {
    id: string;
    action: string;
    actorId: string;
    occurredAt: string;
    comment: string | null;
  }[];
}

export interface Result {
  instanceId: string;
  taskId: string | null;
  status: Status;
}

export interface Asset {
  id: string;
  tag: string;
  name: string;
  status: string;
}

export interface ProposalLine {
  assetId: string;
  reason: string;
}

export interface RemovalRequest {
  currentRevision: number;
  instanceId: string;
  items: (ProposalLine & {
    tag: string;
    name: string;
    revision: number;
    outcome: string | null;
    decisionReason: string | null;
  })[];
  decision: { name: string; reference: string; decidedOn: string } | null;
}

export async function workflowApi<T>(
  path: string,
  options?: { body: unknown; key: string },
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${base}/api/${path}`, {
    credentials: 'include',
    signal,
    ...(options && {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': options.key },
      body: JSON.stringify(options.body),
    }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    if (response.status === 401)
      throw new Error('Sign in through a faculty module to access workflows.');
    if (response.status === 403)
      throw new Error('Your account does not have access to this action or page.');
    throw new Error(
      Array.isArray(body?.message)
        ? body.message.join(' · ')
        : body?.message || `Request failed (${response.status})`,
    );
  }
  return (await response.json()) as T;
}
