export const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(
  /\/+$/,
  '',
);

export async function readApiResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    if (!response.ok) return null;
    throw new Error('The server returned an invalid response.');
  }
}
