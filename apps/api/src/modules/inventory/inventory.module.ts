import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { WorkflowsModule } from '../workflows/workflows.module.js';
import { InventoryRemovalController } from './inventory-removal.controller.js';
import { InventoryRemovalService } from './inventory-removal.service.js';

import { InventoryController } from './inventory.controller.js';
import { InventoryReadService } from './inventory-read.service.js';
import { InventoryTransactionsService } from './inventory-transactions.service.js';
import { InventoryDiscrepanciesController } from './inventory-discrepancies.controller.js';
import { InventoryDiscrepanciesService } from './inventory-discrepancies.service.js';

@Module({
  imports: [AuthModule, WorkflowsModule],
  controllers: [InventoryController, InventoryRemovalController, InventoryDiscrepanciesController],
  providers: [
    InventoryReadService,
    InventoryRemovalService,
    InventoryTransactionsService,
    InventoryDiscrepanciesService,
  ],
})
export class InventoryModule {}
