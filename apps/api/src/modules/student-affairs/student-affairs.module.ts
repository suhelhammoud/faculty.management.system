import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { StudentAffairsController } from './student-affairs.controller.js';
import { StudentAffairsService } from './student-affairs.service.js';

@Module({
  imports: [AuthModule],
  controllers: [StudentAffairsController],
  providers: [StudentAffairsService],
})
export class StudentAffairsModule {}
