import { Global, Module } from '@nestjs/common';
import { DATABASE, DATABASE_POOL } from './database.constants.js';
import { DatabaseHealthController } from './database-health.controller.js';
import { DatabaseHealthService } from './database-health.service.js';
import { DatabasePoolLifecycle } from './database-pool-lifecycle.js';
import { databaseProviders } from './database.providers.js';

@Global()
@Module({
  controllers: [DatabaseHealthController],
  providers: [...databaseProviders, DatabaseHealthService, DatabasePoolLifecycle],
  exports: [DATABASE, DATABASE_POOL, DatabaseHealthService],
})
export class DatabaseModule {}
