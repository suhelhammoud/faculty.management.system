import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { FacultyPositionsController } from './faculty-positions.controller.js';
import { FacultyPositionsService } from './faculty-positions.service.js';

@Module({
  imports: [AuthModule],
  controllers: [FacultyPositionsController],
  providers: [FacultyPositionsService],
})
export class FacultyPositionsModule {}
