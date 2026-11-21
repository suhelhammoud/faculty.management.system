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
import { PERMISSION } from '@project/authorization';
import {
  ClaimPermission,
  RequireActionPermission,
  RequirePermission,
} from '../../auth/auth.guard.js';
import { FacilitiesService } from './facilities.service.js';
import { facilityKind, uuid } from './facilities.schemas.js';
import type { FacilityKind } from './facilities.schemas.js';

@Controller('api/admin/facilities')
@UsePipes(new StandardSchemaValidationPipe())
export class FacilitiesController {
  constructor(@Inject(FacilitiesService) private readonly facilities: FacilitiesService) {}

  @Get()
  @RequirePermission(PERMISSION.facilities.read)
  list() {
    return this.facilities.list();
  }

  @Post(':kind')
  @RequireActionPermission(PERMISSION.facilities.write)
  create(
    @Param('kind', { schema: facilityKind }) kind: FacilityKind,
    @Body() body: unknown,
    @ClaimPermission() claim: () => Promise<void>,
  ) {
    return this.facilities.write(kind, undefined, body, claim);
  }

  @Patch(':kind/:id')
  @RequireActionPermission(PERMISSION.facilities.write)
  update(
    @Param('kind', { schema: facilityKind }) kind: FacilityKind,
    @Param('id', { schema: uuid }) id: string,
    @Body() body: unknown,
    @ClaimPermission() claim: () => Promise<void>,
  ) {
    return this.facilities.write(kind, id, body, claim);
  }
}
