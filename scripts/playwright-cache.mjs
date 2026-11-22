import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(
  new URL('../.cache/ms-playwright', import.meta.url),
);
