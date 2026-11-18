import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

config({ path: fileURLToPath(new URL('./.env.db', import.meta.url)) });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
