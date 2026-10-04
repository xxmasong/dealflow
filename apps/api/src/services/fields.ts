import { z } from 'zod';
import type { FieldDefinition } from '../db/schema.js';
import { badInput } from '../lib/errors.js';

export type FieldValue = string | number | null;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

/**
 * Validates and normalises a raw value for a custom field. Values arrive from
 * GraphQL as JSON scalars; this is the single place that decides what each
 * field type accepts.
 */
export function parseFieldValue(field: Pick<FieldDefinition, 'type' | 'label' | 'options'>, raw: unknown): FieldValue {
  if (raw === null || raw === undefined || raw === '') return null;

  switch (field.type) {
    case 'text': {
      const r = z.string().trim().max(2000).safeParse(raw);
      if (!r.success) throw badInput(`${field.label}: expected text up to 2000 characters`);
      return r.data;
    }
    case 'number':
    case 'metric': {
      const n = typeof raw === 'string' ? Number(raw) : raw;
      const r = z.number().finite().safeParse(n);
      if (!r.success) throw badInput(`${field.label}: expected a number`);
      return r.data;
    }
    case 'date': {
      const r = isoDate.safeParse(raw);
      if (!r.success || Number.isNaN(Date.parse(r.data))) {
        throw badInput(`${field.label}: expected a date (YYYY-MM-DD)`);
      }
      return r.data;
    }
    case 'select': {
      if (typeof raw !== 'string' || !field.options.includes(raw)) {
        throw badInput(`${field.label}: must be one of ${field.options.join(', ')}`);
      }
      return raw;
    }
  }
}

/** Machine key derived from a label: "ARR Growth %" -> "arr_growth". */
export function keyFromLabel(label: string): string {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  if (!key) throw badInput('Label must contain letters or digits');
  return key;
}
