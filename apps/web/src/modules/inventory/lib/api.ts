import {
  MutationCache,
  QueryCache,
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useRef } from 'react';

export type Capabilities = {
  read: boolean;
  configure: boolean;
  postTransactions: boolean;
  dispose: boolean;
  requestRemoval: boolean;
  monitorWorkflows: boolean;
  hasEmployeeProfile: boolean;
};
export type Session = {
  user: {
    id: string;
    name: string;
    username?: string;
    approved: boolean;
    enabled: boolean;
    mustChangePassword: boolean;
  };
} | null;
export type Ref = {
  id: string;
  name: string;
  code?: string;
  number?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  status?: string;
  unit?: string;
};
export type Storage = {
  roomId: string;
  name: string;
  code: string;
  roomStatus: string;
  enabled: number;
  sharedAccountId: string;
  sharedAccount: string;
};
export type AssetRow = {
  asset: {
    id: string;
    tag: string;
    name: string;
    category: string | null;
    model: string | null;
    serialNumber: string | null;
    acquisitionReference: string | null;
    notes: string | null;
    status: string;
    condition: string;
    revision: number;
    roomId: string | null;
  };
  custody: { employeeId: string | null; sharedAccountId: string | null } | null;
  room: string | null;
  isStorage: boolean;
  employee: { id: string; nameEn: string | null; nameAr: string | null } | null;
  sharedAccount: string | null;
};
export type MyItems = {
  linkedEmployee: boolean;
  items: {
    id: string;
    tag: string;
    name: string;
    condition: string;
    room: string | null;
    assignedAt: string;
  }[];
};
export type Stock = { roomId: string; quantity: number; item: Ref; room: string };
export type Entry = {
  id: string;
  type: string;
  name: string;
  reference: string | null;
  eventDate: string;
  recordedAt: string;
  actorId: string;
  actorName: string | null;
  source: string | null;
  sourceRoomId: string | null;
  destinationRoomId: string | null;
  recipientEmployeeId: string | null;
  notes: string | null;
};
type Snapshot = {
  status: string;
  condition: string;
  roomId: string | null;
  employeeId: string | null;
  sharedAccountId: string | null;
};
export type Transaction = Entry & {
  labels: { rooms: Ref[]; employees: NonNullable<AssetRow['employee']>[]; sharedAccounts: Ref[] };
  items: {
    line: number;
    assetTag: string | null;
    assetName: string | null;
    itemCode: string | null;
    itemName: string | null;
    unit: string | null;
    quantity: number | null;
    before: Snapshot | null;
    after: Snapshot | null;
    outcome: string | null;
    reason: string | null;
  }[];
};

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const base = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
export async function api<T>(
  path: string,
  options: { signal?: AbortSignal; body?: unknown; key?: string; method?: string } = {},
) {
  const { signal, body, key, method = body === undefined ? 'GET' : 'POST' } = options;
  let response: Response;
  try {
    response = await fetch(`${base}/api/${path}`, {
      credentials: 'include',
      signal,
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(key && { 'Idempotency-Key': key }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, 'Unable to reach the server.');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(response.status, typeof result?.message === 'string' ? result.message : '');
  return result as T;
}

export function createClient() {
  const expire = (error: Error) => {
    if (error instanceof ApiError && error.status === 401) {
      void client.cancelQueries();
      client.setQueryData(['session'], null);
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
      client.getMutationCache().clear();
    }
  };
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: expire }),
    mutationCache: new MutationCache({ onError: expire }),
    defaultOptions: {
      queries: {
        staleTime: 15000,
        retry: (count, error) => (!(error instanceof ApiError) || error.status >= 500) && count < 1,
      },
      mutations: { retry: false },
    },
  });
  return client;
}
export const useResource = <T>(path: string, enabled = true, alwaysRefresh = false) =>
  useQuery({
    queryKey: ['inventory', path],
    queryFn: ({ signal }) => api<T>(path, { signal }),
    enabled,
    ...(alwaysRefresh && {
      staleTime: 0,
      refetchOnMount: 'always' as const,
      refetchOnWindowFocus: 'always' as const,
    }),
  });
export function useWrite<T>(path: string, method = 'POST') {
  const client = useQueryClient();
  const pending = useRef<{ payload: string; key: string } | null>(null);
  return useMutation({
    mutationFn: (body: unknown) => {
      const payload = JSON.stringify(body);
      if (pending.current?.payload !== payload)
        pending.current = { payload, key: crypto.randomUUID() };
      return api<T>(path, { body, key: pending.current.key, method });
    },
    onSuccess: async () => {
      pending.current = null;
      await client.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 403)
        void client.invalidateQueries({ queryKey: ['inventory', 'inventory/capabilities'] });
    },
  });
}
export const workflow = '/inventory/workflow';
export const asQuery = (path: string, params: Record<string, string | number | undefined>) => {
  const [pathname, search] = path.split('?', 2);
  const result = new URLSearchParams(search);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') result.set(key, String(value));
  }
  return result.size ? `${pathname}?${result}` : pathname;
};
