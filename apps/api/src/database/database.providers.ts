import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDb } from '@project/db';
import { DATABASE, DATABASE_POOL } from './database.constants.js';

const DATABASE_RESOURCES = Symbol('DATABASE_RESOURCES');
type DatabaseResources = ReturnType<typeof createDb>;

const databaseResourcesProvider: Provider = {
  provide: DATABASE_RESOURCES,
  useFactory: (configService: ConfigService): DatabaseResources =>
    createDb(configService.getOrThrow<string>('DATABASE_URL')),
  inject: [ConfigService],
};

export const databaseProvider: Provider = {
  provide: DATABASE,
  useFactory: (resources: DatabaseResources) => resources.db,
  inject: [DATABASE_RESOURCES],
};

export const databasePoolProvider: Provider = {
  provide: DATABASE_POOL,
  useFactory: (resources: DatabaseResources) => resources.pool,
  inject: [DATABASE_RESOURCES],
};

export const databaseProviders: Provider[] = [
  databaseResourcesProvider,
  databaseProvider,
  databasePoolProvider,
];
