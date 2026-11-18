import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  StandardSchemaValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { RequirePermission } from '../../auth/auth.guard.js';
import { FacilitiesService } from './facilities.service.js';
import { facilityKind, uuid } from './facilities.schemas.js';
import type { FacilityKind } from './facilities.schemas.js';

@Controller('api/admin/facilities')
@UsePipes(new StandardSchemaValidationPipe())
export class FacilitiesController {
  constructor(@Inject(FacilitiesService) private readonly facilities: FacilitiesService) {}

  @Get()
  @RequirePermission('facilities:read')
  list() {
    return this.facilities.list();
  }

  @Post(':kind')
  @RequirePermission('facilities:write')
  create(@Param('kind', { schema: facilityKind }) kind: FacilityKind, @Body() body: unknown) {
    return this.facilities.write(kind, undefined, body);
  }

  @Patch(':kind/:id')
  @RequirePermission('facilities:write')
  update(
    @Param('kind', { schema: facilityKind }) kind: FacilityKind,
    @Param('id', { schema: uuid }) id: string,
    @Body() body: unknown,
  ) {
    return this.facilities.write(kind, id, body);
  }
}
