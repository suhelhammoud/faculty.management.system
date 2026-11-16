import { QueryCache, MutationCache, QueryClient } from '@tanstack/react-query';
export class ApiError extends Error {
  status: number;
  details: string[];
  constructor(status: number, details: string[] = []) {
    const known = details.find((message) =>
      [
        'Cannot change the category of a position used by employment records',
        'Position must exist and belong to the selected category',
        'A referenced record does not exist or is still in use',
        'Concurrent update; retry the request',
      ].includes(message),
    );
    super(
      known ||
        (status === 401
          ? 'Your session expired. Please sign in again.'
          : status === 403
            ? 'You do not have permission, or your account is restricted.'
            : status === 404
              ? 'Record not found.'
              : status === 409
                ? 'A record with these values already exists.'
                : status === 400
                  ? 'Check the form values and try again.'
                  : 'Unable to complete the request.'),
    );
    this.status = status;
    this.details = details;
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
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Unable to reach the server.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const messages = Array.isArray(data?.message)
      ? data.message.filter((m: unknown) => typeof m === 'string')
      : typeof data?.message === 'string'
        ? [data.message]
        : [];
    const error = new ApiError(response.status, messages);
    if (path === 'auth/sign-in/username' && response.status < 500)
      error.message = messages.some((m: string) => /disabled/i.test(m))
        ? 'Your account is disabled.'
        : 'Invalid username or password.';
    throw error;
  }
  return data;
}
export const hrApi = <T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal) =>
  api<T>(`admin/hr/${path}`, method, body, signal);
export function createHrClient() {
  let client: QueryClient;
  const expire = (error: Error) => {
    if (error instanceof ApiError && error.status === 401) {
      void client.cancelQueries();
      client.setQueryData(['hr', 'session'], null);
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
