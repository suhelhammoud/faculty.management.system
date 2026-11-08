
export const DATABASE = Symbol('DATABASE');
export const DATABASE_POOL = Symbol('DATABASE_POOL');

export interface DatabasePool {
  query(queryText: string): Promise<unknown>;
  end(): Promise<void>;
}
