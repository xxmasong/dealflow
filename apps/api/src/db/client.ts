import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';
import * as schema from './schema.js';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export type Db = ReturnType<typeof drizzlePglite<typeof schema>>;

export interface Database {
  db: Db;
  close: () => Promise<void>;
}

// `postgres://...` connects to a real server. Anything else is treated as a
// PGlite data directory ("memory://" for an in-memory database), which keeps
// local development and tests free of external services.
export async function openDatabase(url: string): Promise<Database> {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    const pool = new pg.Pool({ connectionString: url });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder });
    // Both drivers expose the same query builder; the cast only narrows the
    // driver-specific result metadata we never use.
    return { db: db as unknown as Db, close: () => pool.end() };
  }

  const inMemory = url === 'memory://';
  if (!inMemory) mkdirSync(url, { recursive: true });
  const client = new PGlite(inMemory ? undefined : url);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  return { db, close: () => client.close() };
}
