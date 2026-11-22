import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { PERMISSION, PERMISSION_CATALOG } from '@project/authorization';
import type { Database } from '@project/db';
import { workflowDrafts, user } from '@project/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { ActorId, RequirePermission, RequireSession } from '../../auth/auth.guard.js';
import { AuthorizationService } from '../../auth/authorization.service.js';
import { DATABASE } from '../../database/database.constants.js';
import { WorkflowRegistry } from './workflow-registry.js';
import { designSchema, exportDesign, templateDraft } from './designer-model.js';
const edit = PERMISSION.workflow.designEdit;
function parse<T>(schema: z.ZodType<T>, body: unknown) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BadRequestException('Invalid workflow draft');
  return parsed.data;
}
@Controller('api/workflow/designer')
@RequireSession()
export class DesignerController {
  constructor(
    @Inject(DATABASE) private db: Database,
    @Inject(AuthorizationService) private auth: AuthorizationService,
    @Inject(WorkflowRegistry) private registry: WorkflowRegistry,
  ) {}
  @Get('capabilities') async capabilities(@ActorId() actor: string) {
    const canEdit = await this.auth.can(actor, edit);
    return {
      canEdit,
      canRead: canEdit || (await this.auth.can(actor, PERMISSION.workflow.designRead)),
    };
  }
  private async reader(actor: string) {
    if (!(await this.capabilities(actor)).canRead) throw new ForbiddenException();
  }
  @Get('catalog') async catalog(@ActorId() actor: string) {
    await this.reader(actor);
    return {
      templates: this.registry.templates().map(templateDraft),
      permissions: PERMISSION_CATALOG.map((p) => p.key),
    };
  }
  @Get('drafts') async list(@ActorId() actor: string) {
    await this.reader(actor);
    return this.db
      .select({
        id: workflowDrafts.id,
        title: sql<string>`${workflowDrafts.document}->>'title'`,
        updatedBy: user.name,
        updatedAt: workflowDrafts.updatedAt,
      })
      .from(workflowDrafts)
      .innerJoin(user, eq(user.id, workflowDrafts.updatedBy))
      .orderBy(desc(workflowDrafts.updatedAt));
  }
  @Get('drafts/:id') async read(@ActorId() actor: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.reader(actor);
    const [row] = await this.db.select().from(workflowDrafts).where(eq(workflowDrafts.id, id));
    if (!row) throw new NotFoundException();
    return row;
  }
  @Post('drafts') @RequirePermission(edit) async create(
    @ActorId() actor: string,
    @Body() body: unknown,
  ) {
    const document = parse(designSchema, body);
    const [row] = await this.db
      .insert(workflowDrafts)
      .values({ document, createdBy: actor, updatedBy: actor })
      .returning();
    return row;
  }
  @Put('drafts/:id') @RequirePermission(edit) async save(
    @ActorId() actor: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const { revision, document } = parse(
      z.strictObject({ revision: z.number().int().positive(), document: designSchema }),
      body,
    );
    const [row] = await this.db
      .update(workflowDrafts)
      .set({ document, revision: revision + 1, updatedBy: actor, updatedAt: new Date() })
      .where(and(eq(workflowDrafts.id, id), eq(workflowDrafts.revision, revision)))
      .returning();
    if (!row) throw new ConflictException('Draft changed. Reload latest or save as new draft.');
    return row;
  }
  @Get('drafts/:id/export') async export(
    @ActorId() actor: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const row = await this.read(actor, id);
    return exportDesign(parse(designSchema, row.document));
  }
}
