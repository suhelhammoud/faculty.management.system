export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const base = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(
  /\/$/,
  "",
);
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(base + "/api/" + path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      response.status === 403
        ? "You do not have permission for this action, or your account is restricted."
        : data?.message || `Request failed (${response.status})`,
    );
  return data;
}
