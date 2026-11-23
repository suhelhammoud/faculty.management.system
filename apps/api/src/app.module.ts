import { DepartmentModule } from './modules/department/department.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuthModule } from './auth/auth.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';
import { CorrespondenceModule } from './modules/correspondence/correspondence.module.js';
import { ExamsModule } from './modules/exams/exams.module.js';
import { FacultyPositionsModule } from './modules/faculty-positions/faculty-positions.module.js';
import { FacilitiesModule } from './modules/facilities/facilities.module.js';
import { HrModule } from './modules/hr/hr.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { MaintenanceModule } from './modules/maintenance/maintenance.module.js';
import { MeetingsModule } from './modules/meetings/meetings.module.js';
import { StudentAffairsModule } from './modules/student-affairs/student-affairs.module.js';
import { SupervisionModule } from './modules/supervision/supervision.module.js';
import { WorkflowsModule } from './modules/workflows/workflows.module.js';

function validateEnvironment(config: Record<string, string | undefined>) {
  const databaseUrl = config.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }

  let parsedDatabaseUrl: URL;
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL');
  }

  if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
    throw new Error('DATABASE_URL must use the postgres:// or postgresql:// scheme');
  }

  const port = config.PORT === undefined ? 4000 : Number(config.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return { ...config, DATABASE_URL: databaseUrl, PORT: port };
}

function findWorkspaceRoot(startDirectory: string): string {
  let directory = resolve(startDirectory);
  while (true) {
    if (existsSync(resolve(directory, 'packages/db/package.json'))) return directory;
    const parent = resolve(directory, '..');
    if (parent === directory) return startDirectory;
    directory = parent;
  }
}

const workspaceRoot = findWorkspaceRoot(process.cwd());

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(workspaceRoot, 'packages/db/.env.db'),
        resolve(workspaceRoot, 'apps/api/.env'),
      ],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    AuthModule,
    WorkflowsModule,
    AttendanceModule,
    MaintenanceModule,
    SupervisionModule,
    MeetingsModule,
    HrModule,
    ExamsModule,
    CorrespondenceModule,
    InventoryModule,
    StudentAffairsModule,
    DepartmentModule,
    FacilitiesModule,
    FacultyPositionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
