import { afterAll, beforeAll, beforeEach } from 'vitest';
import { openDatabase, type Database } from '../src/db/client.js';
import { fieldDefinitions, organizations, stages, users } from '../src/db/schema.js';
import type { Viewer } from '../src/context.js';

export interface Fixture {
  db: Database['db'];
  viewer: Viewer;
  otherViewer: Viewer;
  stageIds: { lead: string; qualified: string; proposal: string; won: string; lost: string };
  fieldIds: { round: string; arrGrowth: string; closeDate: string };
}

/**
 * Seeds a fresh organisation (plus a second one for isolation checks) with
 * stages and fields. Every query in the app is scoped by organisation, so tests
 * can share one database and still never see each other's rows.
 */
async function seed(db: Database['db']): Promise<Fixture> {
  const tag = crypto.randomUUID().slice(0, 8);
  const [org, other] = await db.insert(organizations).values([{ name: 'Acme Ventures' }, { name: 'Other Fund' }]).returning();
  const [me, them] = await db
    .insert(users)
    .values([
      { orgId: org!.id, email: `me-${tag}@acme.test`, name: 'Me', passwordHash: 'x' },
      { orgId: other!.id, email: `them-${tag}@other.test`, name: 'Them', passwordHash: 'x' },
    ])
    .returning();

  const created = await db
    .insert(stages)
    .values([
      { orgId: org!.id, name: 'Lead', position: 0 },
      { orgId: org!.id, name: 'Qualified', position: 1 },
      { orgId: org!.id, name: 'Proposal', position: 2 },
      { orgId: org!.id, name: 'Won', position: 3, isWon: true },
      { orgId: org!.id, name: 'Lost', position: 4, isLost: true },
    ])
    .returning();
  const byName = Object.fromEntries(created.map((s) => [s.name, s.id]));

  const fields = await db
    .insert(fieldDefinitions)
    .values([
      { orgId: org!.id, key: 'round', label: 'Round', type: 'select', options: ['Seed', 'Series A'], position: 0 },
      { orgId: org!.id, key: 'arr_growth', label: 'ARR growth', type: 'metric', unit: '%', position: 1 },
      { orgId: org!.id, key: 'close_date', label: 'Close date', type: 'date', position: 2 },
    ])
    .returning();

  return {
    db,
    viewer: { id: me!.id, orgId: org!.id },
    otherViewer: { id: them!.id, orgId: other!.id },
    stageIds: {
      lead: byName.Lead!,
      qualified: byName.Qualified!,
      proposal: byName.Proposal!,
      won: byName.Won!,
      lost: byName.Lost!,
    },
    fieldIds: { round: fields[0]!.id, arrGrowth: fields[1]!.id, closeDate: fields[2]!.id },
  };
}

/**
 * Opens one in-memory database per test file (PGlite takes a few seconds to
 * boot) and hands each test a freshly seeded organisation.
 */
export function useFixture(): () => Fixture {
  let database: Database;
  let current: Fixture;
  beforeAll(async () => {
    database = await openDatabase('memory://');
  });
  afterAll(async () => {
    await database?.close();
  });
  beforeEach(async () => {
    current = await seed(database.db);
  });
  return () => current;
}
