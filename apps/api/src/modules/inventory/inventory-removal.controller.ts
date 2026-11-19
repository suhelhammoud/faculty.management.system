import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
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
import { ActorId, RequirePermission, RequireSession } from '../../auth/auth.guard.js';
import { parseIdempotencyKey } from '../workflows/workflows.controller.js';
import { InventoryRemovalService } from './inventory-removal.service.js';
import { asset, custody, proposal, uuid } from './inventory-removal.schemas.js';

@Controller('api/inventory/workflow')
@RequireSession()
@UsePipes(new StandardSchemaValidationPipe())
export class InventoryRemovalController {
  constructor(
    @Inject(InventoryRemovalService) private readonly inventory: InventoryRemovalService,
  ) {}

  @Get('assets')
  listAssets(
    @ActorId() actorId: string,
    @Query('requestId', { schema: uuid.optional() }) requestId?: string,
  ) {
    return this.inventory.listAssets(actorId, requestId);
  }

  @Post('assets')
  @RequirePermission(PERMISSION.inventory.manageAssets)
  registerAsset(@ActorId() actorId: string, @Body({ schema: asset }) body: z.infer<typeof asset>) {
    return this.inventory.registerAsset(actorId, body);
  }

  @Patch('assets/:id/custody')
  @HttpCode(204)
  @RequirePermission(PERMISSION.inventory.manageAssets, 'inventory.asset')
  changeCustody(
    @ActorId() actorId: string,
    @Param('id', { schema: uuid }) id: string,
    @Body({ schema: custody }) body: z.infer<typeof custody>,
  ) {
    return this.inventory.changeCustody(actorId, id, body.employeeId);
  }

  @Post('removal-requests')
  start(
    @ActorId() actorId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body({ schema: proposal }) body: z.infer<typeof proposal>,
  ) {
    return this.inventory.start(actorId, body, parseIdempotencyKey(key));
  }

  @Get('removal-requests/:id')
  details(@ActorId() actorId: string, @Param('id', { schema: uuid }) id: string) {
    return this.inventory.details(id, actorId);
  }
}
