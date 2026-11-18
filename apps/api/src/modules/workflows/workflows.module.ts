import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { WorkflowRegistry } from './workflow-registry.js';
import { WorkflowsController } from './workflows.controller.js';
import { WorkflowsService } from './workflows.service.js';

@Module({
  imports: [AuthModule],
  controllers: [WorkflowsController],
  providers: [WorkflowRegistry, WorkflowsService],
  exports: [WorkflowRegistry, WorkflowsService],
})
export class WorkflowsModule {}
