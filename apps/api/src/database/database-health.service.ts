import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DATABASE_POOL, type DatabasePool } from './database.constants.js';

@Injectable()
export class DatabaseHealthService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: DatabasePool) {}

  async check(): Promise<{ status: 'ok'; database: 'connected' }> {
    try {
      await this.pool.query('SELECT 1');
      return { status: 'ok', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unavailable',
      });
    }
  }
}
