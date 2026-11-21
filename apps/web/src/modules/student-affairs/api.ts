import {
  MutationCache,
  QueryCache,
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

export const root = '/student-affairs';
export const dataKey = ['student-affairs', 'data'];
export const sessionKey = ['student-affairs', 'session'];
const origin = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${origin}/api/${path}`, {
    method,
    credentials: 'include',
    cache: 'no-store',
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? undefined : await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(response.status, typeof data?.message === 'string' ? data.message : '');
  return data as T;
}

export function createClient() {
  const onError = (error: Error) => {
    if (!(error instanceof ApiError)) return;
    if (error.status === 401) {
      void clearData(client);
      client.setQueryData(sessionKey, null);
    }
    if (error.status === 403) {
      void client.invalidateQueries({ queryKey: [...dataKey, 'capabilities'] });
    }
  };
  const client = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (
          query.queryKey[1] === 'data' &&
          error instanceof ApiError &&
          (query.queryKey[2] !== 'capabilities' || error.status === 401)
        )
          onError(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _input, _context, mutation) => {
        if (mutation.options.mutationKey?.[1] === 'data') onError(error);
      },
    }),
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: true, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return client;
}

export async function clearData(client: QueryClient) {
  await client.cancelQueries({ queryKey: dataKey });
  client.removeQueries({ queryKey: dataKey });
  client.getMutationCache().clear();
}

export function useRead<T>(path: string, poll?: number) {
  return useQuery({
    queryKey: [...dataKey, path],
    queryFn: ({ signal }) => request<T>(`student-affairs/${path}`, 'GET', undefined, signal),
    refetchInterval: poll,
  });
}

export function useWrite<T = void>() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: dataKey,
    mutationFn: ({
      path,
      method,
      body,
    }: {
      path: string;
      method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: object;
    }) => request<T>(`student-affairs/${path}`, method, body),
    onSuccess: () => client.invalidateQueries({ queryKey: dataKey }),
  });
}
