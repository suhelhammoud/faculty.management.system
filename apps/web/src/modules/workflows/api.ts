import { apiOrigin } from '@/lib/api-response';

export async function workflowApi<T>(
  path: string,
  options?: { body: unknown; key: string },
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${apiOrigin}/api/${path}`, {
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
