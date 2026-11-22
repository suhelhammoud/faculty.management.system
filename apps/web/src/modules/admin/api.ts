import { apiOrigin, readApiResponse } from '@/lib/api-response';
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(apiOrigin + '/api/' + path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await readApiResponse(response);
  if (!response.ok)
    throw new ApiError(
      response.status,
      response.status === 403
        ? 'You do not have permission for this action, or your account is restricted.'
        : data?.message || `Request failed (${response.status})`,
    );
  return data;
}
