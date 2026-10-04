import { eq } from 'drizzle-orm';
import { hashPassword } from '../auth.js';
import type { Db } from './client.js';
import { dealFieldValues, dealHistory, deals, fieldDefinitions, organizations, stages, users } from './schema.js';
import { initialKeys } from '../lib/position.js';

export const DEMO_EMAIL = 'demo@dealflow.dev';
export const DEMO_PASSWORD = 'demo1234';

const COMPANIES = [
  'Northwind Analytics',
  'Contoso Health',
  'Fabrikam Robotics',
  'Tailspin Logistics',
  'Wingtip Energy',
  'Adatum Security',
  'Litware Learning',
  'Proseware Payments',
  'Lucerne Bio',
  'Coho Foods',
  'Trey Research',
  'Margie Travel',
  'Woodgrove Fintech',
  'Alpine Ski Labs',
  'Blue Yonder Air',
  'Fourth Coffee',
  'Humongous Insurance',
  'Wide World Imports',
  'Graphic Design Institute',
  'Relecloud',
  'VanArsdel Media',
  'Southridge Video',
  'City Power & Light',
  'Lamna Healthcare',
  'Nod Publishers',
  'Bellows College',
  'Datum Corporation',
  'First Up Consultants',
  'Best For You Organics',
  'Consolidated Messenger',
];
const ROUNDS = ['Pre-seed', 'Seed', 'Series A', 'Series B'];
const SECTORS = ['Fintech', 'Health', 'Climate', 'SaaS', 'Logistics', 'Consumer'];

// Small deterministic PRNG so the demo data is the same on every boot.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

/** Creates the demo organisation once. Safe to call on every start. */
export async function seedDemo(db: Db): Promise<void> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL));
  if (existing) return;

  const rand = rng(7);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const DAY = 86_400_000;
  const now = Date.now();

  await db.transaction(async (tx) => {
    const [org] = await tx.insert(organizations).values({ name: 'Demo Capital' }).returning();
    const orgId = org!.id;
    const team = await tx
      .insert(users)
      .values([
        { orgId, email: DEMO_EMAIL, name: 'Demo Partner', passwordHash: await hashPassword(DEMO_PASSWORD) },
        {
          orgId,
          email: 'analyst@dealflow.dev',
          name: 'Riley Analyst',
          passwordHash: await hashPassword(crypto.randomUUID()),
        },
        {
          orgId,
          email: 'principal@dealflow.dev',
          name: 'Sam Principal',
          passwordHash: await hashPassword(crypto.randomUUID()),
        },
      ])
      .returning();

    const pipeline = await tx
      .insert(stages)
      .values([
        { orgId, name: 'Sourced', position: 0 },
        { orgId, name: 'First meeting', position: 1 },
        { orgId, name: 'Diligence', position: 2 },
        { orgId, name: 'Term sheet', position: 3 },
        { orgId, name: 'Invested', position: 4, isWon: true },
        { orgId, name: 'Passed', position: 5, isLost: true },
      ])
      .returning();

    const [round, sector, arr, growth, nextStep] = await tx
      .insert(fieldDefinitions)
      .values([
        { orgId, key: 'round', label: 'Round', type: 'select', options: ROUNDS, position: 0 },
        { orgId, key: 'sector', label: 'Sector', type: 'select', options: SECTORS, position: 1 },
        { orgId, key: 'arr', label: 'ARR (USD)', type: 'number', position: 2 },
        { orgId, key: 'arr_growth', label: 'ARR growth', type: 'metric', unit: '%', position: 3 },
        { orgId, key: 'next_step', label: 'Next step date', type: 'date', position: 4 },
      ])
      .returning();

    const perStage = new Map<string, number>();
    const plans = COMPANIES.map((company) => {
      // Walk each deal some way down the funnel; later stages are rarer.
      let reached = 0;
      while (reached < 3 && rand() < 0.62) reached++;
      const r = rand();
      const closed = reached === 3 ? (r < 0.35 ? 4 : r < 0.6 ? 5 : null) : r < 0.15 ? 5 : null;
      const path = [...Array(reached + 1).keys()].map((i) => pipeline[i]!);
      if (closed !== null) path.push(pipeline[closed]!);
      const final = path.at(-1)!;
      perStage.set(final.id, (perStage.get(final.id) ?? 0) + 1);
      return { company, path, final };
    });

    const keysByStage = new Map(pipeline.map((s) => [s.id, initialKeys(perStage.get(s.id) ?? 0)]));

    for (const plan of plans) {
      const owner = pick(team);
      const amountCents = Math.round((0.5 + rand() * 9.5) * 1_000_000) * 100;
      const dealRound = pick(ROUNDS);
      const created = new Date(now - (20 + Math.floor(rand() * 70)) * DAY);
      const [deal] = await tx
        .insert(deals)
        .values({
          orgId,
          stageId: plan.final.id,
          ownerId: owner.id,
          name: `${dealRound} round`,
          company: plan.company,
          amountCents,
          position: keysByStage.get(plan.final.id)!.shift()!,
          createdAt: created,
          updatedAt: created,
        })
        .returning();
      const dealId = deal!.id;

      const values: Array<[typeof round, string | number]> = [
        [round, dealRound],
        [sector, pick(SECTORS)],
        [arr, Math.round((0.2 + rand() * 8) * 1_000_000)],
        [growth, Math.round(20 + rand() * 180)],
        [nextStep, new Date(now + Math.floor(rand() * 30) * DAY).toISOString().slice(0, 10)],
      ];
      await tx.insert(dealFieldValues).values(values.map(([field, value]) => ({ dealId, fieldId: field!.id, value })));

      // Back-dated history so the dashboard has something to show.
      let at = created.getTime();
      const entries: (typeof dealHistory.$inferInsert)[] = [
        {
          orgId,
          dealId,
          actorId: owner.id,
          kind: 'created',
          newValue: { stage: { id: plan.path[0]!.id, name: plan.path[0]!.name }, amountCents },
          createdAt: new Date(at),
        },
      ];
      for (let i = 1; i < plan.path.length; i++) {
        at += (2 + Math.floor(rand() * 12)) * DAY;
        if (at > now) at = now - Math.floor(rand() * DAY);
        const from = plan.path[i - 1]!;
        const to = plan.path[i]!;
        entries.push({
          orgId,
          dealId,
          actorId: pick(team).id,
          kind: 'stage_changed',
          oldValue: { id: from.id, name: from.name },
          newValue: { id: to.id, name: to.name },
          createdAt: new Date(at),
        });
        if (rand() < 0.5) {
          entries.push({
            orgId,
            dealId,
            actorId: owner.id,
            kind: 'field_changed',
            field: 'arr_growth',
            oldValue: Math.round(20 + rand() * 100),
            newValue: values[3]![1],
            createdAt: new Date(at + 3_600_000),
          });
        }
      }
      await tx.insert(dealHistory).values(entries);
    }
  });
}
