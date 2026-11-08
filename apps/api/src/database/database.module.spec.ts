import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { DATABASE, DATABASE_POOL } from './database.constants.js';
import { DatabaseHealthService } from './database-health.service.js';
import { DatabaseModule } from './database.module.js';
import { DatabasePoolLifecycle } from './database-pool-lifecycle.js';

const { createDbMock } = vi.hoisted(() => ({ createDbMock: vi.fn() }));
vi.mock('@project/db', () => ({ createDb: createDbMock }));

describe('DatabaseModule', () => {
  const database = { marker: 'drizzle-db' };
  const databaseUrl = 'postgresql://test:test@localhost:5432/test';
  let pool: { query: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    pool = {
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      end: vi.fn().mockResolvedValue(undefined),
    };
    createDbMock.mockReset().mockReturnValue({ db: database, pool });
  });

  async function createTestingModule(): Promise<TestingModule> {
    return Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: () => ({ DATABASE_URL: databaseUrl }),
        }),
        DatabaseModule,
      ],
    }).compile();
  }

  it('creates one client and exposes the database and pool separately', async () => {
    const moduleRef = await createTestingModule();

    expect(createDbMock).toHaveBeenCalledTimes(1);
    expect(createDbMock).toHaveBeenCalledWith(databaseUrl);
    expect(moduleRef.get(DATABASE)).toBe(database);
    expect(moduleRef.get(DATABASE_POOL)).toBe(pool);

    await moduleRef.close();
  });

  it('runs a sanitized SELECT 1 health check through the shared pool', async () => {
    const moduleRef = await createTestingModule();
    const health = moduleRef.get(DatabaseHealthService);

    await expect(health.check()).resolves.toEqual({
      status: 'ok',
      database: 'connected',
    });
    expect(pool.query).toHaveBeenCalledWith('SELECT 1');

    pool.query.mockRejectedValueOnce(new Error('connection secret detail'));
    await expect(health.check()).rejects.toMatchObject({
      response: { status: 'error', database: 'unavailable' },
    });

    await moduleRef.close();
  });

  it('closes the shared pool once during application shutdown', async () => {
    const moduleRef = await createTestingModule();
    const lifecycle = moduleRef.get(DatabasePoolLifecycle);

    await moduleRef.close();
    await lifecycle.onApplicationShutdown();

    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});
