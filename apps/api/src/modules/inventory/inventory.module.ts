import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { WorkflowsModule } from '../workflows/workflows.module.js';
import { InventoryRemovalController } from './inventory-removal.controller.js';
import { InventoryRemovalService } from './inventory-removal.service.js';

@Module({
  imports: [AuthModule, WorkflowsModule],
  controllers: [InventoryRemovalController],
  providers: [InventoryRemovalService],
})
export class InventoryModule {}
