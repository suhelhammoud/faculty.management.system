import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import type { FacilityKind } from './types';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const base = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}/api/${path}`, {
      method,
      credentials: 'include',
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Unable to reach the server.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(' ')
      : typeof data?.message === 'string'
        ? data.message
        : response.status === 401
          ? 'Your session expired. Please sign in again.'
          : response.status === 403
            ? 'You do not have permission, or your account is restricted.'
            : response.status === 404
              ? 'Record not found.'
              : response.status === 409
                ? 'A record with these values already exists.'
                : 'Unable to complete the request.';
    throw new ApiError(response.status, message);
  }
  return data as T;
}

export const facilityApi = <T>(path = '', method = 'GET', body?: unknown, signal?: AbortSignal) =>
  api<T>(`admin/facilities${path ? `/${path}` : ''}`, method, body, signal);

export const authApi = <T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal) =>
  api<T>(path, method, body, signal);

export function createFacilitiesClient() {
  let client: QueryClient;
  const expire = (error: Error) => {
    if (error instanceof ApiError && error.status === 401) {
      void client.cancelQueries();
      client.setQueryData(['facilities', 'session'], null);
      client.removeQueries({ predicate: (query) => query.queryKey[1] !== 'session' });
      client.getMutationCache().clear();
    }
  };
  client = new QueryClient({
    queryCache: new QueryCache({ onError: expire }),
    mutationCache: new MutationCache({ onError: expire }),
    defaultOptions: {
      queries: {
        staleTime: 30000,
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
      },
      mutations: { retry: false },
    },
  });
  return client;
}

export function facilityResourcePath(kind: FacilityKind, id?: string) {
  return id ? `${kind}/${id}` : kind;
}
