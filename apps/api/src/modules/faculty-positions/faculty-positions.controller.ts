import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  StandardSchemaValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { PERMISSION } from '@project/authorization';
import type {
  CreateFacultyPosition,
  FacultyPositionTitles,
  FacultyPositionsResponse,
  UpdateFacultyPositionHolder,
} from '@project/contracts/faculty-positions';
import { z } from 'zod';
import { ActorId, RequirePermission } from '../../auth/auth.guard.js';
import { AuthorizationService } from '../../auth/authorization.service.js';
import { FacultyPositionsService } from './faculty-positions.service.js';

const code = z
  .string()
  .trim()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const titles = z.strictObject({
  titleEn: z.string().trim().min(1).max(200),
  titleAr: z.string().trim().min(1).max(200).nullable().optional(),
});
const create = titles.extend({ code, departmentCode: code.nullable().optional() });
const holder = z.strictObject({
  userId: z.string().trim().min(1).nullable(),
  expectedAppointmentId: z.uuid().nullable(),
  appointmentDate: z.iso.date().optional(),
});

@Controller('api/admin/faculty-positions')
@UsePipes(new StandardSchemaValidationPipe())
export class FacultyPositionsController {
  constructor(
    @Inject(FacultyPositionsService) private readonly positions: FacultyPositionsService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
  ) {}

  @Get()
  @RequirePermission(PERMISSION.facultyPositions.read)
  async list(@ActorId() actorId: string): Promise<FacultyPositionsResponse> {
    const [positions, canManage] = await Promise.all([
      this.positions.list(),
      this.authorization.can(actorId, PERMISSION.facultyPositions.manage),
    ]);
    return { positions, canManage };
  }

  @Get('departments')
  @RequirePermission(PERMISSION.facultyPositions.manage)
  departments() {
    return this.positions.departmentOptions();
  }

  @Get('eligible-holders')
  @RequirePermission(PERMISSION.facultyPositions.manage)
  eligibleHolders() {
    return this.positions.eligibleHolders();
  }

  @Get(':id/appointments')
  @RequirePermission(PERMISSION.facultyPositions.read)
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.positions.history(id);
  }

  @Post()
  @RequirePermission(PERMISSION.facultyPositions.manage)
  create(@Body({ schema: create }) body: CreateFacultyPosition, @ActorId() actorId: string) {
    return this.positions.create(body, actorId);
  }

  @Patch(':id')
  @RequirePermission(PERMISSION.facultyPositions.manage)
  updateTitles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: titles }) body: FacultyPositionTitles,
    @ActorId() actorId: string,
  ) {
    return this.positions.updateTitles(id, body, actorId);
  }

  @Put(':id/holder')
  @RequirePermission(PERMISSION.facultyPositions.manage)
  updateHolder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: holder }) body: UpdateFacultyPositionHolder,
    @ActorId() actorId: string,
  ) {
    return this.positions.updateHolder(id, body, actorId);
  }
}
