import { describe, expect, it } from 'vitest';
import { openDatabase } from './client.js';
import { organizations } from './schema.js';

describe('openDatabase', () => {
  it('migrates an in-memory database', async () => {
    const { db, close } = await openDatabase('memory://');
    const [org] = await db.insert(organizations).values({ name: 'Acme' }).returning();
    expect(org?.id).toMatch(/^[0-9a-f-]{36}$/);
    await close();
  });
});
