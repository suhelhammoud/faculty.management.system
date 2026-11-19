import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Put,
  Query,
  StandardSchemaValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { PERMISSION } from '@project/authorization';
import type { z } from 'zod';
import { ActorId, RequirePermission, RequireSession } from '../../auth/auth.guard.js';
import { parseIdempotencyKey } from '../workflows/workflows.controller.js';
import { InventoryReadService } from './inventory-read.service.js';
import { InventoryTransactionsService } from './inventory-transactions.service.js';
import {
  assetQuery,
  consumableInput,
  historyQuery,
  referenceQuery,
  sharedInput,
  stockQuery,
  storageInput,
  transactionInput,
  uuid,
} from './inventory.schemas.js';

@Controller('api/inventory')
@RequireSession()
@UsePipes(new StandardSchemaValidationPipe())
export class InventoryController {
  constructor(
    @Inject(InventoryReadService) private readonly inventory: InventoryReadService,
    @Inject(InventoryTransactionsService)
    private readonly transactions: InventoryTransactionsService,
  ) {}

  @Get('assets')
  @RequirePermission(PERMISSION.inventory.read)
  assets(@Query({ schema: assetQuery }) query: z.infer<typeof assetQuery>) {
    return this.inventory.assets(query);
  }

  @Get('stock')
  @RequirePermission(PERMISSION.inventory.read)
  stock(@Query({ schema: stockQuery }) query: z.infer<typeof stockQuery>) {
    return this.inventory.stock(query);
  }

  @Get('transactions')
  @RequirePermission(PERMISSION.inventory.read)
  history(@Query({ schema: historyQuery }) query: z.infer<typeof historyQuery>) {
    return this.inventory.history(query);
  }

  @Get('transactions/:id')
  @RequirePermission(PERMISSION.inventory.read)
  detail(@Param('id', { schema: uuid }) id: string) {
    return this.inventory.detail(id);
  }

  @Post('transactions')
  post(
    @ActorId() actorId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body({ schema: transactionInput }) input: z.infer<typeof transactionInput>,
  ) {
    return this.transactions.post(actorId, input, parseIdempotencyKey(key));
  }

  @Get('rooms')
  @RequirePermission(PERMISSION.inventory.read)
  rooms(@Query({ schema: referenceQuery }) query: z.infer<typeof referenceQuery>) {
    return this.inventory.rooms(query);
  }

  @Get('storage')
  @RequirePermission(PERMISSION.inventory.read)
  storage(@Query({ schema: referenceQuery }) query: z.infer<typeof referenceQuery>) {
    return this.inventory.storage(query);
  }

  @Put('storage/:id')
  @RequirePermission(PERMISSION.inventory.configure)
  configureStorage(
    @Param('id', { schema: uuid }) id: string,
    @Body({ schema: storageInput }) body: z.infer<typeof storageInput>,
  ) {
    return this.inventory.configureStorage(id, body);
  }

  @Get('shared-accounts')
  @RequirePermission(PERMISSION.inventory.read)
  shared(@Query({ schema: referenceQuery }) query: z.infer<typeof referenceQuery>) {
    return this.inventory.shared(query);
  }

  @Post('shared-accounts')
  @RequirePermission(PERMISSION.inventory.configure)
  createShared(@Body({ schema: sharedInput }) body: z.infer<typeof sharedInput>) {
    return this.inventory.createShared(body.name);
  }

  @Get('employees')
  @RequirePermission(PERMISSION.inventory.read)
  employees(@Query({ schema: referenceQuery }) query: z.infer<typeof referenceQuery>) {
    return this.inventory.employees(query);
  }

  @Get('consumables')
  @RequirePermission(PERMISSION.inventory.read)
  consumables(@Query({ schema: referenceQuery }) query: z.infer<typeof referenceQuery>) {
    return this.inventory.consumables(query);
  }

  @Post('consumables')
  @RequirePermission(PERMISSION.inventory.configure)
  createConsumable(@Body({ schema: consumableInput }) body: z.infer<typeof consumableInput>) {
    return this.inventory.createConsumable(body);
  }
}
