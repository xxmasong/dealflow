import DataLoader from 'dataloader';
import { inArray } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import {
  fieldDefinitions,
  stages,
  users,
  type DealFieldValue,
  type FieldDefinition,
  type Stage,
  type User,
} from '../db/schema.js';
import { fieldValuesFor } from '../services/deals.js';

function byId<T extends { id: string }>(rows: T[], ids: readonly string[]): (T | null)[] {
  const map = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => map.get(id) ?? null);
}

/**
 * Per-request batch loaders. A board of 200 deals resolves its stages, owners
 * and custom field values in one query each instead of one query per card.
 */
export function createLoaders(db: Db) {
  return {
    stage: new DataLoader<string, Stage | null>(async (ids) =>
      byId(
        await db
          .select()
          .from(stages)
          .where(inArray(stages.id, [...ids])),
        ids,
      ),
    ),
    user: new DataLoader<string, User | null>(async (ids) =>
      byId(
        await db
          .select()
          .from(users)
          .where(inArray(users.id, [...ids])),
        ids,
      ),
    ),
    field: new DataLoader<string, FieldDefinition | null>(async (ids) =>
      byId(
        await db
          .select()
          .from(fieldDefinitions)
          .where(inArray(fieldDefinitions.id, [...ids])),
        ids,
      ),
    ),
    fieldValues: new DataLoader<string, DealFieldValue[]>(async (dealIds) => {
      const rows = await fieldValuesFor(db, dealIds);
      return dealIds.map((id) => rows.filter((r) => r.dealId === id));
    }),
  };
}

export type Loaders = ReturnType<typeof createLoaders>;
