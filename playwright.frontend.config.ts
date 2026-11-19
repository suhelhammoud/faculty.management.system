import { defineConfig } from '@playwright/test';

const shellPort = 4300;
const hrPort = 4305;
const shellOrigin = `http://localhost:${shellPort}`;
const hrOrigin = `http://localhost:${hrPort}`;

function previewBuild(app: 'shell' | 'hr', port: number) {
  const outDir = `../../dist/frontend-smoke-build/${app}`;
  return (
    `pnpm --filter ${app} build --outDir ${outDir} --emptyOutDir` +
    ` && pnpm --filter ${app} preview --outDir ${outDir} --host localhost --port ${port} --strictPort`
  );
}

export default defineConfig({
  testDir: './apps/shell/e2e',
  outputDir: './dist/frontend-smoke',
  use: { baseURL: shellOrigin, browserName: 'chromium' },
  webServer: [
    {
      command: previewBuild('shell', shellPort),
      url: shellOrigin,
      env: {
        VITE_HR_REMOTE_URL: `${hrOrigin}/remoteEntry.js`,
        VITE_ATTENDANCE_REMOTE_URL: 'http://localhost:4301/remoteEntry.js',
      },
      timeout: 60_000,
    },
    {
      command: previewBuild('hr', hrPort),
      url: `${hrOrigin}/remoteEntry.js`,
      env: { VITE_API_URL: shellOrigin },
      timeout: 60_000,
    },
  ],
});
