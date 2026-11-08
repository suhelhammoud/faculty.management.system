import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { DATABASE_POOL, type DatabasePool } from './database.constants.js';

@Injectable()
export class DatabasePoolLifecycle implements OnApplicationShutdown {
  private shutdownPromise: Promise<void> | undefined;

  constructor(@Inject(DATABASE_POOL) private readonly pool: DatabasePool) {}

  onApplicationShutdown(): Promise<void> {
    return (this.shutdownPromise ??= this.pool.end());
  }
}
