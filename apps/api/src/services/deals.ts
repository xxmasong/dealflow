import { and, asc, desc, eq, gt, ilike, inArray, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Viewer } from '../context.js';
import type { Db } from '../db/client.js';
import { dealFieldValues, dealHistory, deals, fieldDefinitions, stages, users, type Deal } from '../db/schema.js';
import { badInput, notFound } from '../lib/errors.js';
import { keyBetween } from '../lib/position.js';
import { parseFieldValue } from './fields.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Executor = Db | Tx;

const Money = z.number().int().min(0).max(1e15);
const Currency = z.string().regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code');

const DealInput = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  company: z.string().trim().min(1, 'Company is required').max(200),
  amountCents: Money.default(0),
  currency: Currency.default('USD'),
  stageId: z.string().uuid(),
  ownerId: z.string().uuid().nullish(),
});

const DealPatch = z
  .object({
    name: z.string().trim().min(1).max(200),
    company: z.string().trim().min(1).max(200),
    amountCents: Money,
    currency: Currency,
    ownerId: z.string().uuid().nullable(),
  })
  .partial();

// Attributes tracked in the audit trail, mapped to their column on `deals`.
const TRACKED = ['name', 'company', 'amountCents', 'currency', 'ownerId'] as const;
type Tracked = (typeof TRACKED)[number];

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw badInput(r.error.issues.map((i) => i.message).join('; '));
  return r.data;
}

async function stageInOrg(db: Executor, orgId: string, stageId: string) {
  const [stage] = await db
    .select()
    .from(stages)
    .where(and(eq(stages.id, stageId), eq(stages.orgId, orgId)));
  if (!stage) throw notFound('Stage');
  return stage;
}

async function ownerInOrg(db: Executor, orgId: string, ownerId: string | null | undefined) {
  if (!ownerId) return;
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, ownerId), eq(users.orgId, orgId)));
  if (!owner) throw notFound('Owner');
}

async function dealInOrg(db: Executor, orgId: string, dealId: string, lock = false): Promise<Deal> {
  const query = db
    .select()
    .from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.orgId, orgId)));
  const [deal] = lock ? await query.for('update') : await query;
  if (!deal) throw notFound('Deal');
  return deal;
}

async function lastPosition(db: Executor, orgId: string, stageId: string) {
  const [last] = await db
    .select({ position: deals.position })
    .from(deals)
    .where(and(eq(deals.orgId, orgId), eq(deals.stageId, stageId)))
    .orderBy(desc(deals.position))
    .limit(1);
  return last?.position ?? null;
}

export async function listDeals(
  db: Db,
  orgId: string,
  filter: { stageId?: string | null; search?: string | null } = {},
) {
  const conditions = [eq(deals.orgId, orgId)];
  if (filter.stageId) conditions.push(eq(deals.stageId, filter.stageId));
  const term = filter.search?.trim();
  if (term) {
    const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conditions.push(or(ilike(deals.name, like), ilike(deals.company, like))!);
  }
  return db
    .select()
    .from(deals)
    .where(and(...conditions))
    .orderBy(asc(deals.stageId), asc(deals.position));
}

export function getDeal(db: Db, orgId: string, dealId: string) {
  return dealInOrg(db, orgId, dealId);
}

export async function createDeal(db: Db, viewer: Viewer, input: unknown): Promise<Deal> {
  const data = parse(DealInput, input);
  return db.transaction(async (tx) => {
    const stage = await stageInOrg(tx, viewer.orgId, data.stageId);
    await ownerInOrg(tx, viewer.orgId, data.ownerId);
    const position = keyBetween(await lastPosition(tx, viewer.orgId, stage.id), null);

    const [deal] = await tx
      .insert(deals)
      .values({ ...data, ownerId: data.ownerId ?? null, orgId: viewer.orgId, position })
      .returning();

    await tx.insert(dealHistory).values({
      orgId: viewer.orgId,
      dealId: deal!.id,
      actorId: viewer.id,
      kind: 'created',
      newValue: { stage: { id: stage.id, name: stage.name }, amountCents: deal!.amountCents },
    });
    return deal!;
  });
}

export async function updateDeal(db: Db, viewer: Viewer, dealId: string, patch: unknown): Promise<Deal> {
  const data = parse(DealPatch, patch);
  return db.transaction(async (tx) => {
    const current = await dealInOrg(tx, viewer.orgId, dealId, true);
    if (data.ownerId !== undefined) await ownerInOrg(tx, viewer.orgId, data.ownerId);

    const changed = TRACKED.filter((k: Tracked) => data[k] !== undefined && data[k] !== current[k]);
    if (changed.length === 0) return current;

    const [updated] = await tx
      .update(deals)
      .set({ ...Object.fromEntries(changed.map((k) => [k, data[k]])), updatedAt: new Date() })
      .where(eq(deals.id, dealId))
      .returning();

    await tx.insert(dealHistory).values(
      changed.map((k) => ({
        orgId: viewer.orgId,
        dealId,
        actorId: viewer.id,
        kind: 'attribute_changed' as const,
        field: k,
        oldValue: current[k],
        newValue: data[k],
      })),
    );
    return updated!;
  });
}

/**
 * Moves a deal to `stageId`, placed between the neighbours the client saw
 * (`afterDealId` above it, `beforeDealId` below it). Either neighbour may be
 * omitted to drop at the top or bottom of the column.
 */
export async function moveDeal(
  db: Db,
  viewer: Viewer,
  args: { dealId: string; stageId: string; afterDealId?: string | null; beforeDealId?: string | null },
): Promise<Deal> {
  return db.transaction(async (tx) => {
    const deal = await dealInOrg(tx, viewer.orgId, args.dealId, true);
    const target = await stageInOrg(tx, viewer.orgId, args.stageId);

    const neighbour = async (id: string | null | undefined) => {
      if (!id) return null;
      if (id === deal.id) throw badInput('A deal cannot be its own neighbour');
      const n = await dealInOrg(tx, viewer.orgId, id);
      if (n.stageId !== target.id) throw badInput('Neighbour is in a different stage');
      return n.position;
    };
    let above = await neighbour(args.afterDealId);
    let below = await neighbour(args.beforeDealId);

    // Only one neighbour given: find the other one ourselves so the new key
    // never collides with a card the client didn't know about.
    if (above !== null && below === null) {
      const [next] = await tx
        .select({ position: deals.position })
        .from(deals)
        .where(and(eq(deals.stageId, target.id), gt(deals.position, above), sql`${deals.id} <> ${deal.id}`))
        .orderBy(asc(deals.position))
        .limit(1);
      below = next?.position ?? null;
    } else if (above === null && below !== null) {
      const [prev] = await tx
        .select({ position: deals.position })
        .from(deals)
        .where(and(eq(deals.stageId, target.id), lt(deals.position, below), sql`${deals.id} <> ${deal.id}`))
        .orderBy(desc(deals.position))
        .limit(1);
      above = prev?.position ?? null;
    } else if (above === null && below === null) {
      above = await lastPosition(tx, viewer.orgId, target.id);
      if (above === deal.position && deal.stageId === target.id) return deal;
    }
    if (above !== null && below !== null && above >= below) {
      throw badInput('Neighbours are out of order; refresh and try again');
    }

    const [moved] = await tx
      .update(deals)
      .set({ stageId: target.id, position: keyBetween(above, below), updatedAt: new Date() })
      .where(eq(deals.id, deal.id))
      .returning();

    if (deal.stageId !== target.id) {
      const [from] = await tx.select().from(stages).where(eq(stages.id, deal.stageId));
      await tx.insert(dealHistory).values({
        orgId: viewer.orgId,
        dealId: deal.id,
        actorId: viewer.id,
        kind: 'stage_changed',
        // Names are copied so the history still reads correctly after a rename.
        oldValue: { id: deal.stageId, name: from?.name ?? null },
        newValue: { id: target.id, name: target.name },
      });
    }
    return moved!;
  });
}

export async function setFieldValue(db: Db, viewer: Viewer, args: { dealId: string; fieldId: string; value: unknown }) {
  return db.transaction(async (tx) => {
    await dealInOrg(tx, viewer.orgId, args.dealId, true);
    const [field] = await tx
      .select()
      .from(fieldDefinitions)
      .where(and(eq(fieldDefinitions.id, args.fieldId), eq(fieldDefinitions.orgId, viewer.orgId)));
    if (!field) throw notFound('Field');
    if (field.archived) throw badInput(`${field.label} is archived`);

    const value = parseFieldValue(field, args.value);
    const [existing] = await tx
      .select()
      .from(dealFieldValues)
      .where(and(eq(dealFieldValues.dealId, args.dealId), eq(dealFieldValues.fieldId, field.id)));
    const oldValue = existing?.value ?? null;
    if (oldValue === value) return { fieldId: field.id, value };

    await tx
      .insert(dealFieldValues)
      .values({ dealId: args.dealId, fieldId: field.id, value })
      .onConflictDoUpdate({
        target: [dealFieldValues.dealId, dealFieldValues.fieldId],
        set: { value, updatedAt: new Date() },
      });
    await tx.update(deals).set({ updatedAt: new Date() }).where(eq(deals.id, args.dealId));
    await tx.insert(dealHistory).values({
      orgId: viewer.orgId,
      dealId: args.dealId,
      actorId: viewer.id,
      kind: 'field_changed',
      field: field.key,
      oldValue,
      newValue: value,
    });
    return { fieldId: field.id, value };
  });
}

export async function fieldValuesFor(db: Db, dealIds: readonly string[]) {
  if (dealIds.length === 0) return [];
  return db
    .select()
    .from(dealFieldValues)
    .where(inArray(dealFieldValues.dealId, [...dealIds]));
}

export async function historyFor(db: Db, orgId: string, dealId: string) {
  await dealInOrg(db, orgId, dealId);
  return db
    .select()
    .from(dealHistory)
    .where(and(eq(dealHistory.orgId, orgId), eq(dealHistory.dealId, dealId)))
    .orderBy(desc(dealHistory.createdAt), desc(dealHistory.id));
}
