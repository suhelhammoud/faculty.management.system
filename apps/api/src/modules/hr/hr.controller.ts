import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  StandardSchemaValidationPipe,
  UnauthorizedException,
  UsePipes,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { PERMISSION } from '@project/authorization';
import type { Request } from 'express';
import { AUTH, type Auth } from '../../auth/auth.provider.js';
import {
  ClaimPermission,
  RequireActionPermission,
  RequirePermission,
} from '../../auth/auth.guard.js';
import { HrEmployeesService } from './hr-employees.service.js';
import { HrReferenceService } from './hr-reference.service.js';
import {
  employeeCreate,
  employeePatch,
  employeeQuery,
  employmentPut,
  uuid,
  referenceKind,
  referenceQuery,
} from './hr.schemas.js';
import type {
  EmployeeCreate,
  EmployeePatch,
  EmployeeQuery,
  EmploymentPut,
  ReferenceKind,
} from './hr.schemas.js';

@Controller('api/admin/hr')
@UsePipes(new StandardSchemaValidationPipe())
export class HrController {
  constructor(
    @Inject(HrEmployeesService) private readonly employees: HrEmployeesService,
    @Inject(HrReferenceService) private readonly references: HrReferenceService,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  private async actor(req: Request) {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new UnauthorizedException();
    return session.user.id;
  }

  @Get('employees')
  @RequirePermission(PERMISSION.hrEmployees.read)
  listEmployees(@Query({ schema: employeeQuery }) query: EmployeeQuery) {
    return this.employees.list(query);
  }

  @Post('employees')
  @RequireActionPermission(PERMISSION.hrEmployees.create)
  async createEmployee(
    @Body({ schema: employeeCreate }) body: EmployeeCreate,
    @Req() req: Request,
    @ClaimPermission() claim: () => Promise<void>,
  ) {
    const actorId = await this.actor(req);
    await claim();
    return this.employees.create(body, actorId);
  }

  @Get('employees/:employeeId')
  @RequirePermission(PERMISSION.hrEmployees.read)
  getEmployee(@Param('employeeId', { schema: uuid }) id: string) {
    return this.employees.get(id);
  }

  @Patch('employees/:employeeId')
  @RequireActionPermission(PERMISSION.hrEmployees.update)
  async updateEmployee(
    @Param('employeeId', { schema: uuid }) id: string,
    @Body({ schema: employeePatch }) body: EmployeePatch,
    @Req() req: Request,
    @ClaimPermission() claim: () => Promise<void>,
  ) {
    const actorId = await this.actor(req);
    await claim();
    return this.employees.update(id, body, actorId);
  }

  @Put('employees/:employeeId/employment')
  @RequireActionPermission(PERMISSION.hrEmployees.update)
  async putEmployment(
    @Param('employeeId', { schema: uuid }) id: string,
    @Body({ schema: employmentPut }) body: EmploymentPut,
    @Req() req: Request,
    @ClaimPermission() claim: () => Promise<void>,
  ) {
    const actorId = await this.actor(req);
    await claim();
    return this.employees.putEmployment(id, body, actorId);
  }

  @Get(':kind')
  @RequirePermission(PERMISSION.hrReferenceData.read)
  listReference(
    @Param('kind', { schema: referenceKind }) kind: ReferenceKind,
    @Query({ schema: referenceQuery }) query: { categoryId?: string; schemeId?: string },
  ) {
    return this.references.list(kind, query);
  }

  @Post(':kind')
  @RequireActionPermission(PERMISSION.hrReferenceData.write)
  async createReference(
    @Param('kind', { schema: referenceKind }) kind: ReferenceKind,
    @Body() body: unknown,
    @Req() req: Request,
    @ClaimPermission() claim: () => Promise<void>,
  ) {
    return this.references.write(kind, undefined, body, await this.actor(req), claim);
  }

  @Patch(':kind/:id')
  @RequireActionPermission(PERMISSION.hrReferenceData.write)
  async updateReference(
    @Param('kind', { schema: referenceKind }) kind: ReferenceKind,
    @Param('id', { schema: uuid }) id: string,
    @Body() body: unknown,
    @Req() req: Request,
    @ClaimPermission() claim: () => Promise<void>,
  ) {
    return this.references.write(kind, id, body, await this.actor(req), claim);
  }
}
