import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const fieldType = pgEnum('field_type', ['text', 'number', 'date', 'select', 'metric']);

export const historyKind = pgEnum('history_kind', ['created', 'stage_changed', 'attribute_changed', 'field_changed']);

const id = () =>
  uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const organizations = pgTable('organizations', {
  id: id(),
  name: text('name').notNull(),
  createdAt: createdAt(),
});

export const users = pgTable(
  'users',
  {
    id: id(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

export const stages = pgTable(
  'stages',
  {
    id: id(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    isWon: boolean('is_won').notNull().default(false),
    isLost: boolean('is_lost').notNull().default(false),
  },
  (t) => [index('stages_org_idx').on(t.orgId, t.position)],
);

export const deals = pgTable(
  'deals',
  {
    id: id(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => stages.id),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    company: text('company').notNull(),
    // Money is stored in minor units to avoid floating point drift.
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    // Sort key inside a stage column. Fractional so a move only rewrites one row.
    position: text('position').notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('deals_org_stage_idx').on(t.orgId, t.stageId)],
);

export const fieldDefinitions = pgTable(
  'field_definitions',
  {
    id: id(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    type: fieldType('type').notNull(),
    // Allowed options for `select` fields; empty for every other type.
    options: jsonb('options')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    unit: text('unit'),
    position: integer('position').notNull().default(0),
    archived: boolean('archived').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('field_definitions_org_key_idx').on(t.orgId, t.key)],
);

export const dealFieldValues = pgTable(
  'deal_field_values',
  {
    dealId: uuid('deal_id')
      .notNull()
      .references(() => deals.id, { onDelete: 'cascade' }),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => fieldDefinitions.id, { onDelete: 'cascade' }),
    value: jsonb('value').$type<string | number | null>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.dealId, t.fieldId] })],
);

// Append-only audit trail. Every change to a deal writes one row here in the
// same transaction as the change itself.
export const dealHistory = pgTable(
  'deal_history',
  {
    id: id(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    dealId: uuid('deal_id')
      .notNull()
      .references(() => deals.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    kind: historyKind('kind').notNull(),
    // Attribute name ("amount", "name") or custom field key; null for created/stage events.
    field: text('field'),
    oldValue: jsonb('old_value').$type<unknown>(),
    newValue: jsonb('new_value').$type<unknown>(),
    // clock_timestamp() rather than now(): several entries written in one
    // transaction still get distinct, ordered timestamps.
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    index('deal_history_deal_idx').on(t.dealId, t.createdAt),
    index('deal_history_org_kind_idx').on(t.orgId, t.kind, t.createdAt),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Stage = typeof stages.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type FieldDefinition = typeof fieldDefinitions.$inferSelect;
export type DealFieldValue = typeof dealFieldValues.$inferSelect;
export type DealHistoryEntry = typeof dealHistory.$inferSelect;
