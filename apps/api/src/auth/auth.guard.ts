import {
  CanActivate,
  createParamDecorator,
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
import type { PermissionKey } from '@project/authorization';
export const Public = () => SetMetadata('auth:public', true);
export const RequireSession = () => SetMetadata('auth:session', true);
const actorId = Symbol('authenticated actor');
const claimAttempt = Symbol('claim elevated permission');
type AuthenticatedRequest = Request & {
  [actorId]?: string;
  [claimAttempt]?: () => Promise<void>;
};
export const ActorId = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const id = context.switchToHttp().getRequest<AuthenticatedRequest>()[actorId];
  if (!id) throw new UnauthorizedException();
  return id;
});
export const ClaimPermission = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const claim = context.switchToHttp().getRequest<AuthenticatedRequest>()[claimAttempt];
  if (!claim) throw new ForbiddenException();
  return claim;
});
export const RequirePermission = (
  permission: PermissionKey,
  resourceType?: string,
  idParam = 'id',
) => SetMetadata('auth:permission', { permission, resourceType, idParam });
export const RequireActionPermission = (
  permission: PermissionKey,
  resourceType?: string,
  idParam = 'id',
) => SetMetadata('auth:permission', { permission, resourceType, idParam, elevated: true });
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH) private readonly auth: Auth,
    private readonly authorization: AuthorizationService,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride('auth:public', [context.getHandler(), context.getClass()]))
      return true;
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const current = await this.auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!current) throw new UnauthorizedException();
    const rule = this.reflector.getAllAndOverride<{
      permission: string;
      resourceType?: string;
      idParam: string;
      elevated?: boolean;
    }>('auth:permission', [context.getHandler(), context.getClass()]);
    if (!rule) {
      const requiresSession = this.reflector.getAllAndOverride<boolean>('auth:session', [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!requiresSession) throw new ForbiddenException('Endpoint has no authorization policy');
      if (!(await this.authorization.isActive(current.user.id))) throw new ForbiddenException();
      req[actorId] = current.user.id;
      return true;
    }
    const id = req.params[rule.idParam];
    if (rule.resourceType && typeof id !== 'string') throw new ForbiddenException();
    const resource = rule.resourceType ? { type: rule.resourceType, id: id as string } : undefined;
    if (rule.elevated) {
      req[claimAttempt] = await this.authorization.prepareAttempt(
        current.user.id,
        rule.permission,
        resource,
      );
    } else if (!(await this.authorization.can(current.user.id, rule.permission, resource))) {
      throw new ForbiddenException();
    }
    req[actorId] = current.user.id;
    return true;
  }
}
