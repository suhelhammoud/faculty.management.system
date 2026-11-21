import { defineConfig } from '@playwright/test';

const port = 4300;
const origin = `http://localhost:${port}`;
const outDir = '../../dist/frontend-smoke-build/web';

export default defineConfig({
  testDir: './apps/web/e2e',
  outputDir: './dist/frontend-smoke',
  use: { baseURL: origin, browserName: 'chromium' },
  webServer: {
    command:
      `pnpm --filter web build --outDir ${outDir} --emptyOutDir --manifest` +
      ` && pnpm --filter web preview --outDir ${outDir} --host localhost --port ${port} --strictPort`,
    url: origin,
    env: { VITE_API_URL: origin },
    timeout: 60_000,
  },
});
