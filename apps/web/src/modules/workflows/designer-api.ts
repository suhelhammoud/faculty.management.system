import { apiOrigin, readApiResponse } from '@/lib/api-response';
export class DesignError extends Error {
  constructor(publicStatus: number, message: string) {
    super(message);
    this.status = publicStatus;
  }
  readonly status: number;
}
export async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(apiOrigin + '/api/workflow/designer/' + path, {
    method,
    credentials: 'include',
    cache: 'no-store',
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await readApiResponse(res);
  if (!res.ok)
    throw new DesignError(
      res.status,
      Array.isArray(data?.message)
        ? data.message.join('\n')
        : data?.message || 'Unable to open workflow designs.',
    );
  return data;
}
export type Access = { canRead: boolean; canEdit: boolean };
