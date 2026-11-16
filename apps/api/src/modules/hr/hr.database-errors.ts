import { BadRequestException, ConflictException } from '@nestjs/common';

export async function handleDatabaseErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Drizzle wraps the original PostgreSQL error in `cause`.
    let source: unknown = error;
    for (let depth = 0; depth < 5 && source && typeof source === 'object'; depth++) {
      const pg = source as { code?: string; cause?: unknown };
      if (pg.code === '23505')
        throw new ConflictException('A record with these unique values already exists');
      if (pg.code === '23503')
        throw new BadRequestException('A referenced record does not exist or is still in use');
      if (pg.code === '23514') throw new BadRequestException('Values violate a data constraint');
      if (pg.code === '40001' || pg.code === '40P01')
        throw new ConflictException('Concurrent update; retry the request');
      source = pg.cause;
    }
    throw error;
  }
}
