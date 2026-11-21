import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  StandardSchemaValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { PERMISSION } from '@project/authorization';
import { ActorId, RequirePermission, RequireSession } from '../../auth/auth.guard.js';
import {
  academicYearParam,
  annualCreate,
  annualPatch,
  currentYearPut,
  promotionGrantCreate,
  studentCreate,
  studentPatch,
  studentQuery,
  studyYearParam,
  userId,
  uuid,
} from './student-affairs.schemas.js';
import type {
  AnnualCreate,
  AnnualPatch,
  PromotionGrantCreate,
  StudentCreate,
  StudentPatch,
  StudentQuery,
} from './student-affairs.schemas.js';
import { StudentAffairsService } from './student-affairs.service.js';

const permission = PERMISSION.studentAffairs;

@Controller('api/student-affairs')
@UsePipes(new StandardSchemaValidationPipe())
export class StudentAffairsController {
  constructor(@Inject(StudentAffairsService) private readonly affairs: StudentAffairsService) {}

  @Get('capabilities')
  @RequireSession()
  capabilities(@ActorId() actor: string) {
    return this.affairs.capabilities(actor);
  }

  @Get('students')
  @RequirePermission(permission.read)
  list(@Query({ schema: studentQuery }) query: StudentQuery) {
    return this.affairs.list(query);
  }

  @Post('students')
  @RequirePermission(permission.read)
  create(@ActorId() actor: string, @Body({ schema: studentCreate }) body: StudentCreate) {
    return this.affairs.create(actor, body);
  }

  @Get('students/:studentId')
  @RequirePermission(permission.read)
  get(@Param('studentId', { schema: uuid }) id: string) {
    return this.affairs.get(id);
  }

  @Patch('students/:studentId')
  @RequirePermission(permission.read)
  patch(
    @ActorId() actor: string,
    @Param('studentId', { schema: uuid }) id: string,
    @Body({ schema: studentPatch }) body: StudentPatch,
  ) {
    return this.affairs.patch(actor, id, body);
  }

  @Put('students/:studentId/current-study-year')
  @RequirePermission(permission.administer)
  changeYear(
    @ActorId() actor: string,
    @Param('studentId', { schema: uuid }) id: string,
    @Body({ schema: currentYearPut }) body: { currentStudyYear: number },
  ) {
    return this.affairs.changeYear(actor, id, body.currentStudyYear);
  }

  @Get('students/:studentId/academic-years')
  @RequirePermission(permission.read)
  listAnnual(@Param('studentId', { schema: uuid }) id: string) {
    return this.affairs.listAnnual(id);
  }

  @Post('students/:studentId/academic-years')
  @RequirePermission(permission.read)
  createAnnual(
    @ActorId() actor: string,
    @Param('studentId', { schema: uuid }) id: string,
    @Body({ schema: annualCreate }) body: AnnualCreate,
  ) {
    return this.affairs.createAnnual(actor, id, body);
  }

  @Patch('students/:studentId/academic-years/:academicYear')
  @RequirePermission(permission.read)
  patchAnnual(
    @ActorId() actor: string,
    @Param('studentId', { schema: uuid }) id: string,
    @Param('academicYear', { schema: academicYearParam }) period: string,
    @Body({ schema: annualPatch }) body: AnnualPatch,
  ) {
    return this.affairs.patchAnnual(actor, id, period, body);
  }

  @Get('staff-year-assignments')
  @RequirePermission(permission.administer)
  listStaff() {
    return this.affairs.listStaff();
  }

  @Put('staff-year-assignments/:userId/:studyYear')
  @RequirePermission(permission.administer)
  @HttpCode(204)
  assignYear(
    @ActorId() actor: string,
    @Param('userId', { schema: userId }) recipient: string,
    @Param('studyYear', { schema: studyYearParam }) year: number,
  ) {
    return this.affairs.assignYear(actor, recipient, year);
  }

  @Delete('staff-year-assignments/:userId/:studyYear')
  @RequirePermission(permission.administer)
  @HttpCode(204)
  revokeYear(
    @ActorId() actor: string,
    @Param('userId', { schema: userId }) recipient: string,
    @Param('studyYear', { schema: studyYearParam }) year: number,
  ) {
    return this.affairs.revokeYear(actor, recipient, year);
  }

  @Get('promotion-grants')
  @RequirePermission(permission.grantPromotions)
  listGrants() {
    return this.affairs.listGrants();
  }

  @Get('promotion-grants/recipients')
  @RequirePermission(permission.grantPromotions)
  recipients(@ActorId() actor: string) {
    return this.affairs.promotionRecipients(actor);
  }

  @Get('promotion-grants/current')
  @RequirePermission(permission.administer)
  currentGrant(@ActorId() actor: string) {
    return this.affairs.currentGrant(actor);
  }

  @Post('promotion-grants')
  @RequirePermission(permission.grantPromotions)
  issueGrant(
    @ActorId() actor: string,
    @Body({ schema: promotionGrantCreate }) body: PromotionGrantCreate,
  ) {
    return this.affairs.issueGrant(actor, body);
  }

  @Delete('promotion-grants/:grantId')
  @RequirePermission(permission.grantPromotions)
  @HttpCode(204)
  revokeGrant(@ActorId() actor: string, @Param('grantId', { schema: uuid }) id: string) {
    return this.affairs.revokeGrant(actor, id);
  }
}
