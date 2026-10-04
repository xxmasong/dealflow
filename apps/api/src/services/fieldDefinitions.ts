import { and, asc, eq, max } from 'drizzle-orm';
import { z } from 'zod';
import type { Viewer } from '../context.js';
import type { Db } from '../db/client.js';
import { fieldDefinitions } from '../db/schema.js';
import { badInput, notFound } from '../lib/errors.js';
import { keyFromLabel } from './fields.js';

const Options = z.array(z.string().trim().min(1).max(80)).max(50);

const CreateInput = z
  .object({
    label: z.string().trim().min(1, 'Label is required').max(80),
    type: z.enum(['text', 'number', 'date', 'select', 'metric']),
    options: Options.default([]),
    unit: z.string().trim().max(12).nullish(),
  })
  .refine((v) => v.type !== 'select' || v.options.length > 0, 'Select fields need at least one option');

const UpdateInput = z
  .object({
    label: z.string().trim().min(1).max(80),
    options: Options,
    unit: z.string().trim().max(12).nullable(),
    position: z.number().int().min(0),
  })
  .partial();

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw badInput(r.error.issues.map((i) => i.message).join('; '));
  return r.data;
}

export function listFieldDefinitions(db: Db, orgId: string, includeArchived = false) {
  const where = includeArchived
    ? eq(fieldDefinitions.orgId, orgId)
    : and(eq(fieldDefinitions.orgId, orgId), eq(fieldDefinitions.archived, false));
  return db.select().from(fieldDefinitions).where(where).orderBy(asc(fieldDefinitions.position), asc(fieldDefinitions.label));
}

export async function createFieldDefinition(db: Db, viewer: Viewer, input: unknown) {
  const data = parse(CreateInput, input);
  const key = keyFromLabel(data.label);
  return db.transaction(async (tx) => {
    const [clash] = await tx
      .select({ id: fieldDefinitions.id })
      .from(fieldDefinitions)
      .where(and(eq(fieldDefinitions.orgId, viewer.orgId), eq(fieldDefinitions.key, key)));
    if (clash) throw badInput(`A field with key "${key}" already exists`);

    const [{ last } = { last: null }] = await tx
      .select({ last: max(fieldDefinitions.position) })
      .from(fieldDefinitions)
      .where(eq(fieldDefinitions.orgId, viewer.orgId));

    const [field] = await tx
      .insert(fieldDefinitions)
      .values({
        orgId: viewer.orgId,
        key,
        label: data.label,
        type: data.type,
        options: data.type === 'select' ? data.options : [],
        unit: data.type === 'metric' ? (data.unit ?? null) : null,
        position: (last ?? -1) + 1,
      })
      .returning();
    return field!;
  });
}

export async function updateFieldDefinition(db: Db, viewer: Viewer, id: string, input: unknown) {
  const data = parse(UpdateInput, input);
  const [current] = await db
    .select()
    .from(fieldDefinitions)
    .where(and(eq(fieldDefinitions.id, id), eq(fieldDefinitions.orgId, viewer.orgId)));
  if (!current) throw notFound('Field');
  if (data.options !== undefined && current.type !== 'select') {
    throw badInput('Only select fields have options');
  }
  if (data.options !== undefined && data.options.length === 0) {
    throw badInput('Select fields need at least one option');
  }
  // The key stays fixed on rename so history entries keep pointing at it.
  const [updated] = await db.update(fieldDefinitions).set(data).where(eq(fieldDefinitions.id, id)).returning();
  return updated!;
}

export async function setFieldArchived(db: Db, viewer: Viewer, id: string, archived: boolean) {
  const [updated] = await db
    .update(fieldDefinitions)
    .set({ archived })
    .where(and(eq(fieldDefinitions.id, id), eq(fieldDefinitions.orgId, viewer.orgId)))
    .returning();
  if (!updated) throw notFound('Field');
  return updated;
}
