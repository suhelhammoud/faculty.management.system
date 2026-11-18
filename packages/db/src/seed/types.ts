import type { Database } from '../client.js';

export type SeedTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];
