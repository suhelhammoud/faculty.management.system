import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Query,
  StandardSchemaValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { PERMISSION } from '@project/authorization';
import type { z } from 'zod';
import { ActorId, RequirePermission, RequireSession } from '../../auth/auth.guard.js';
import { AuthorizationService } from '../../auth/authorization.service.js';
import { InventoryDiscrepanciesService } from './inventory-discrepancies.service.js';
import {
  discrepancyInput,
  discrepancyQuery,
  discrepancyReview,
  uuid,
} from './inventory.schemas.js';

@Controller('api/inventory/discrepancies')
@RequireSession()
@UsePipes(new StandardSchemaValidationPipe())
export class InventoryDiscrepanciesController {
  constructor(
    @Inject(InventoryDiscrepanciesService) private readonly reports: InventoryDiscrepanciesService,
    @Inject(AuthorizationService) private readonly auth: AuthorizationService,
  ) {}

  @Post()
  submit(
    @ActorId() actorId: string,
    @Body({ schema: discrepancyInput }) input: z.infer<typeof discrepancyInput>,
  ) {
    return this.reports.submit(actorId, input);
  }

  @Get()
  @RequirePermission(PERMISSION.inventory.read)
  async list(
    @ActorId() actorId: string,
    @Query({ schema: discrepancyQuery }) query: z.infer<typeof discrepancyQuery>,
  ) {
    await this.requireReviewer(actorId);
    return this.reports.list(query);
  }

  @Post(':id/review')
  @RequirePermission(PERMISSION.inventory.read)
  async review(
    @ActorId() actorId: string,
    @Param('id', { schema: uuid }) id: string,
    @Body({ schema: discrepancyReview }) { note }: z.infer<typeof discrepancyReview>,
  ) {
    await this.requireReviewer(actorId);
    return this.reports.review(id, actorId, note);
  }

  private async requireReviewer(actorId: string) {
    if (!(await this.auth.can(actorId, PERMISSION.inventory.postTransactions)))
      throw new ForbiddenException();
  }
}
