import { describe, expect, it } from 'vitest';
import { readApiResponse } from './api-response';

describe('readApiResponse', () => {
  it('rejects a successful response containing an HTML error page', async () => {
    await expect(readApiResponse(new Response('<html>Unavailable</html>'))).rejects.toThrow(
      'The server returned an invalid response.',
    );
  });

  it('leaves HTTP error handling to the caller for non-JSON errors', async () => {
    await expect(readApiResponse(new Response('Unavailable', { status: 503 }))).resolves.toBeNull();
  });

  it('accepts an empty acknowledgement and JSON null', async () => {
    await expect(readApiResponse(new Response(null, { status: 204 }))).resolves.toBeNull();
    await expect(readApiResponse(Response.json(null))).resolves.toBeNull();
  });
});
