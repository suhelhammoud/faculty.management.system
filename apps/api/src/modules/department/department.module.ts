import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { DepartmentController } from './department.controller.js';
import { DepartmentService } from './department.service.js';

@Module({
  imports: [AuthModule],
  controllers: [DepartmentController],
  providers: [DepartmentService],
})
export class DepartmentModule {}
