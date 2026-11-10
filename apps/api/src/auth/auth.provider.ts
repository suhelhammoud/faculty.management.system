import { APIError } from 'better-auth/api';
import { eq } from '@project/db';
import { ConfigService } from '@nestjs/config';
import {
  betterAuth,
  type Auth as BetterAuth,
  type BetterAuthOptions,
} from 'better-auth';
import { username } from 'better-auth/plugins';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import type { Database } from '@project/db';
import * as schema from '@project/db/schema';
import { DATABASE } from '../database/database.constants.js';
export const AUTH = Symbol('AUTH');
export function createAuth(db: Database, config: ConfigService): BetterAuth {
  if (config.getOrThrow<string>('BETTER_AUTH_SECRET').length < 32)
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters');
  const options: BetterAuthOptions = {
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    secret: config.getOrThrow<string>('BETTER_AUTH_SECRET'),
    baseURL: config.getOrThrow<string>('BETTER_AUTH_URL'),
    trustedOrigins: config
      .getOrThrow<string>('TRUSTED_ORIGINS')
      .split(',')
      .map((s) => s.trim()),
    emailAndPassword: { enabled: true, disableSignUp: true },
    disabledPaths: [
      '/sign-in/email',
      '/sign-up/email',
      '/request-password-reset',
      '/reset-password',
    ],
    plugins: [username()],
    user: {
      additionalFields: {
        approved: { type: 'boolean', defaultValue: false, input: false },
        enabled: { type: 'boolean', defaultValue: true, input: false },
        mustChangePassword: {
          type: 'boolean',
          defaultValue: true,
          input: false,
        },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (newSession) => {
            const [person] = await db
              .select()
              .from(schema.user)
              .where(eq(schema.user.id, newSession.userId));
            if (!person?.enabled)
              throw new APIError('FORBIDDEN', {
                message: 'Account is disabled',
              });
            return { data: newSession };
          },
        },
      },
    },
    session: { cookieCache: { enabled: false } },
  };
  return betterAuth(options);
}
export type Auth = ReturnType<typeof createAuth>;
export const authProvider = {
  provide: AUTH,
  inject: [DATABASE, ConfigService],
  useFactory: createAuth,
};
