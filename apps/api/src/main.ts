import { toNodeHandler } from 'better-auth/node';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AUTH, type Auth } from './auth/auth.provider.js';
import type { Request, Response, NextFunction } from 'express';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const configService = app.get(ConfigService);
  const origins = configService
    .getOrThrow<string>('TRUSTED_ORIGINS')
    .split(',')
    .map((s) => s.trim());
  app.enableCors({ origin: origins, credentials: true });
  const handler = toNodeHandler(app.get<Auth>(AUTH));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/auth/')) {
      const allowed = new Map([
        ['/api/auth/sign-in/username', 'POST'],
        ['/api/auth/sign-out', 'POST'],
        ['/api/auth/get-session', 'GET'],
      ]);
      if (allowed.get(req.path) !== req.method) {
        res.sendStatus(404);
        return;
      }
      return handler(req, res);
    }
    if (
      req.method !== 'GET' &&
      req.path.startsWith('/api/admin') &&
      (!req.headers.origin || !origins.includes(req.headers.origin))
    ) {
      res.sendStatus(403);
      return;
    }
    next();
  });
  app.useBodyParser('json');
  app.enableShutdownHooks();
  await app.listen(configService.get<number>('PORT', 3000));
}
await bootstrap();
