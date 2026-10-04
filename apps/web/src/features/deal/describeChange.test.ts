import { describe, expect, it } from 'vitest';
import type { FieldDefinition, HistoryEntry } from '../../graphql/types';
import { describeChange } from './describeChange';

const fields: FieldDefinition[] = [
  { id: 'f1', key: 'arr_growth', label: 'ARR growth', type: 'metric', unit: '%', options: [], position: 0, archived: false },
];
const users = [{ id: 'u1', name: 'Riley', email: 'r@x.test' }];
const lookups = { fields, users, currency: 'USD' };

const entry = (partial: Partial<HistoryEntry>): HistoryEntry => ({
  id: '1',
  kind: 'created',
  field: null,
  oldValue: null,
  newValue: null,
  createdAt: '2026-01-01T00:00:00Z',
  actor: null,
  ...partial,
});

describe('describeChange', () => {
  it('describes stage moves using the stage names captured at the time', () => {
    expect(
      describeChange(entry({ kind: 'stage_changed', oldValue: { name: 'Lead' }, newValue: { name: 'Diligence' } }), lookups),
    ).toBe('moved it from Lead to Diligence');
  });

  it('formats amounts and owners', () => {
    expect(
      describeChange(entry({ kind: 'attribute_changed', field: 'amountCents', oldValue: 100_000, newValue: 250_000 }), lookups),
    ).toBe('changed Amount from $1,000 to $2,500');
    expect(
      describeChange(entry({ kind: 'attribute_changed', field: 'ownerId', oldValue: null, newValue: 'u1' }), lookups),
    ).toBe('reassigned it from nobody to Riley');
  });

  it('uses field labels and metric units', () => {
    expect(describeChange(entry({ kind: 'field_changed', field: 'arr_growth', newValue: 40 }), lookups)).toBe(
      'set ARR growth to 40%',
    );
    expect(
      describeChange(entry({ kind: 'field_changed', field: 'arr_growth', oldValue: 40, newValue: 55 }), lookups),
    ).toBe('changed ARR growth from 40% to 55%');
  });

  it('falls back to the raw key for deleted fields', () => {
    expect(describeChange(entry({ kind: 'field_changed', field: 'old_key', oldValue: 'a', newValue: 'b' }), lookups)).toBe(
      'changed old_key from a to b',
    );
  });
});
