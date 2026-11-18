import { Module } from '@nestjs/common';
import { FacilitiesController } from './facilities.controller.js';
import { FacilitiesService } from './facilities.service.js';
import { AuthModule } from '../../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [FacilitiesController],
  providers: [FacilitiesService],
})
export class FacilitiesModule {}
