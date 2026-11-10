import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import { AUTH, type Auth } from './auth.provider.js';
import { AuthorizationService } from './authorization.service.js';
import type { Request } from 'express';
export const Public = () => SetMetadata('auth:public', true);
export const RequirePermission = (
  permission: string,
  resourceType?: string,
  idParam = 'id',
) => SetMetadata('auth:permission', { permission, resourceType, idParam });
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH) private readonly auth: Auth,
    private readonly authorization: AuthorizationService,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride('auth:public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const req = context.switchToHttp().getRequest<Request>();
    const current = await this.auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!current) throw new UnauthorizedException();
    const rule = this.reflector.getAllAndOverride<{
      permission: string;
      resourceType?: string;
      idParam: string;
    }>('auth:permission', [context.getHandler(), context.getClass()]);
    if (!rule)
      throw new ForbiddenException('Endpoint has no authorization policy');
    const id = req.params[rule.idParam];
    if (rule.resourceType && typeof id !== 'string')
      throw new ForbiddenException();
    if (
      !(await this.authorization.can(
        current.user.id,
        rule.permission,
        rule.resourceType
          ? { type: rule.resourceType, id: id as string }
          : undefined,
      ))
    )
      throw new ForbiddenException();
    return true;
  }
}
