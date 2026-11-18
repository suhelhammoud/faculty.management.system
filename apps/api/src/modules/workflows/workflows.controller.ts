import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  StandardSchemaValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { PERMISSION } from '@project/authorization';
import { z } from 'zod';
import { ActorId, RequirePermission, RequireSession } from '../../auth/auth.guard.js';
import { WorkflowsService } from './workflows.service.js';

export const idempotencyKey = z.string().trim().min(1).max(200).optional();
const uuid = z.uuid();
const act = z.strictObject({
  action: z.string().min(1).max(100),
  comment: z.string().trim().max(4000).optional(),
  input: z.unknown().optional(),
});
const monitorQuery = z.object({
  status: z.enum(['running', 'completed', 'rejected', 'cancelled']).optional(),
  step: z.string().min(1).max(100).optional(),
});

@Controller('api/workflow')
@RequireSession()
@UsePipes(new StandardSchemaValidationPipe())
export class WorkflowsController {
  constructor(@Inject(WorkflowsService) private readonly workflows: WorkflowsService) {}

  @Get('tasks')
  inbox(@ActorId() actorId: string) {
    return this.workflows.inbox(actorId);
  }

  @Get('tasks/:id')
  task(@ActorId() actorId: string, @Param('id', { schema: uuid }) id: string) {
    return this.workflows.task(id, actorId);
  }

  @Get('instances')
  @RequirePermission(PERMISSION.workflow.monitor)
  monitor(
    @ActorId() actorId: string,
    @Query({ schema: monitorQuery }) query: z.infer<typeof monitorQuery>,
  ) {
    return this.workflows.monitor(actorId, query.status, query.step);
  }

  @Get('instances/:id')
  instance(@ActorId() actorId: string, @Param('id', { schema: uuid }) id: string) {
    return this.workflows.instance(id, actorId);
  }

  @Post('tasks/:id/actions')
  @HttpCode(200)
  act(
    @ActorId() actorId: string,
    @Param('id', { schema: uuid }) taskId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body({ schema: act }) body: z.infer<typeof act>,
  ) {
    return this.workflows.act({
      ...body,
      actorId,
      taskId,
      idempotencyKey: parseIdempotencyKey(key),
    });
  }
}

export function parseIdempotencyKey(key: string | undefined) {
  const parsed = idempotencyKey.safeParse(key);
  if (!parsed.success) throw new BadRequestException('Invalid Idempotency-Key header');
  return parsed.data;
}
