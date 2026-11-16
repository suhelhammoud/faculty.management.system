import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { HrController } from './hr.controller.js';
import { HrEmployeesService } from './hr-employees.service.js';
import { HrReferenceService } from './hr-reference.service.js';

@Module({
  imports: [AuthModule],
  controllers: [HrController],
  providers: [HrEmployeesService, HrReferenceService],
})
export class HrModule {}
