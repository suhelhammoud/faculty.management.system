import { Controller, Get } from '@nestjs/common';
import { DatabaseHealthService } from './database-health.service.js';

@Controller('health')
export class DatabaseHealthController {
  constructor(private readonly databaseHealth: DatabaseHealthService) {}

  @Get('database')
  checkDatabase(): Promise<{ status: 'ok'; database: 'connected' }> {
    return this.databaseHealth.check();
  }
}
