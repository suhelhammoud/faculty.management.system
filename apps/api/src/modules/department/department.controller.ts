import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  StandardSchemaValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { PERMISSION } from '@project/authorization';
import type { z } from 'zod';
import { ActorId, RequirePermission } from '../../auth/auth.guard.js';
import {
  assignment,
  candidateQuery,
  departmentUpdate,
  editDraft,
  id,
  newDepartment,
  newPlan,
  publication,
} from './department.schemas.js';
import { DepartmentService } from './department.service.js';

const { read, administer } = PERMISSION.studentAffairs;

@Controller('api/department')
@UsePipes(new StandardSchemaValidationPipe())
export class DepartmentController {
  constructor(@Inject(DepartmentService) private readonly service: DepartmentService) {}

  @Get()
  @RequirePermission(read)
  list() {
    return this.service.list();
  }

  @Post()
  @RequirePermission(administer)
  create(@Body({ schema: newDepartment }) body: z.infer<typeof newDepartment>) {
    return this.service.create(body);
  }

  @Patch(':id')
  @RequirePermission(administer)
  update(
    @Param('id', { schema: id }) value: string,
    @Body({ schema: departmentUpdate }) body: z.infer<typeof departmentUpdate>,
  ) {
    return this.service.update(value, body);
  }

  @Get(':id/curricula')
  @RequirePermission(read)
  versions(@Param('id', { schema: id }) value: string) {
    return this.service.versions(value);
  }

  @Get('curricula/:id')
  @RequirePermission(read)
  detail(@Param('id', { schema: id }) value: string) {
    return this.service.detail(value);
  }

  @Post('curricula')
  @RequirePermission(administer)
  createPlan(@Body({ schema: newPlan }) body: z.infer<typeof newPlan>) {
    return this.service.createPlan(body);
  }

  @Post('curricula/families/:id/drafts')
  @RequirePermission(administer)
  newDraft(@Param('id', { schema: id }) value: string) {
    return this.service.newDraft(value);
  }

  @Patch('curricula/:id')
  @RequirePermission(administer)
  edit(
    @Param('id', { schema: id }) value: string,
    @Body({ schema: editDraft }) body: z.infer<typeof editDraft>,
  ) {
    return this.service.edit(value, body);
  }

  @Post('curricula/:id/publish')
  @RequirePermission(administer)
  publish(
    @Param('id', { schema: id }) value: string,
    @Body({ schema: publication }) body: z.infer<typeof publication>,
  ) {
    return this.service.publish(value, body);
  }

  @Get(':id/students')
  @RequirePermission(administer)
  candidates(
    @Param('id', { schema: id }) value: string,
    @Query({ schema: candidateQuery }) query: z.infer<typeof candidateQuery>,
  ) {
    return this.service.candidates(value, query.page, query.search);
  }

  @Post('assignments')
  @RequirePermission(administer)
  assign(@ActorId() actor: string, @Body({ schema: assignment }) body: z.infer<typeof assignment>) {
    return this.service.assign(actor, body);
  }
}
