import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/e2e-live',
  outputDir: './dist/frontend-live',
  use: { baseURL: process.env.PILOT_WEB_ORIGIN, browserName: 'chromium' },
});
