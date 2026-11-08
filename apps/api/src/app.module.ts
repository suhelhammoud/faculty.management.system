import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { fileURLToPath } from 'node:url';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';

function validateEnvironment(config: Record<string, string | undefined>) {
  const databaseUrl = config.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }

  let parsedDatabaseUrl: URL;
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL');
  }

  if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
    throw new Error('DATABASE_URL must use the postgres:// or postgresql:// scheme');
  }

  const port = config.PORT === undefined ? 3000 : Number(config.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return { ...config, DATABASE_URL: databaseUrl, PORT: port };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // envFilePath: fileURLToPath(new URL('../.env', import.meta.url)),
      envFilePath: '.env',
      validate: validateEnvironment,
    }),
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
