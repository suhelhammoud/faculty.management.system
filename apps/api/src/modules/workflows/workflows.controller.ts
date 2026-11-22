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
const withdraw = act.omit({ action: true });
const inboxQuery = z.strictObject({
  limit: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(100))
    .optional()
    .default(25),
  cursor: z.string().min(1).max(512).optional(),
  subjectModule: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .max(100)
    .optional(),
});
const monitorQuery = inboxQuery.extend({
  status: z.enum(['running', 'completed', 'rejected', 'cancelled']).optional(),
  step: z.string().min(1).max(100).optional(),
});

@Controller('api/workflow')
@RequireSession()
@UsePipes(new StandardSchemaValidationPipe())
export class WorkflowsController {
  constructor(@Inject(WorkflowsService) private readonly workflows: WorkflowsService) {}

  @Get('tasks')
  inbox(
    @ActorId() actorId: string,
    @Query({ schema: inboxQuery }) query: z.infer<typeof inboxQuery>,
  ) {
    return this.workflows.inbox(actorId, query);
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
    return this.workflows.monitor(actorId, query);
  }

  @Get('instances/:id')
  instance(@ActorId() actorId: string, @Param('id', { schema: uuid }) id: string) {
    return this.workflows.instance(id, actorId);
  }

  @Post('instances/:id/withdraw')
  @HttpCode(200)
  withdraw(
    @ActorId() actorId: string,
    @Param('id', { schema: uuid }) instanceId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body({ schema: withdraw }) body: z.infer<typeof withdraw>,
  ) {
    return this.workflows.withdraw({
      ...body,
      actorId,
      instanceId,
      idempotencyKey: parseIdempotencyKey(key),
    });
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
