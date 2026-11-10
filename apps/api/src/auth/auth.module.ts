import { AdminController } from './admin.controller.js';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';
import { Module } from '@nestjs/common';
import { authProvider, AUTH } from './auth.provider.js';
import { AuthorizationService } from './authorization.service.js';
@Module({
  controllers: [AdminController],
  providers: [
    authProvider,
    AuthorizationService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AUTH, AuthorizationService],
})
export class AuthModule {}
