import { beforeEach, describe, expect, it } from 'vitest';
import { useFixture, type Fixture } from '../../test/helpers.js';
import {
  createFieldDefinition,
  listFieldDefinitions,
  setFieldArchived,
  updateFieldDefinition,
} from './fieldDefinitions.js';

const fixture = useFixture();
let f: Fixture;
beforeEach(() => {
  f = fixture();
});

describe('field definitions', () => {
  it('creates a field with a derived key at the end of the list', async () => {
    const field = await createFieldDefinition(f.db, f.viewer, { label: 'Lead source', type: 'text' });
    expect(field).toMatchObject({ key: 'lead_source', position: 3, options: [], unit: null });
  });

  it('keeps options only for select fields and units only for metrics', async () => {
    const metric = await createFieldDefinition(f.db, f.viewer, {
      label: 'Gross margin',
      type: 'metric',
      unit: '%',
      options: ['ignored'],
    });
    expect(metric).toMatchObject({ unit: '%', options: [] });
    await expect(createFieldDefinition(f.db, f.viewer, { label: 'Tier', type: 'select' })).rejects.toThrow(
      /at least one option/,
    );
  });

  it('rejects duplicate keys within an organisation only', async () => {
    await expect(createFieldDefinition(f.db, f.viewer, { label: 'Round', type: 'text' })).rejects.toThrow(
      /already exists/,
    );
    await expect(createFieldDefinition(f.db, f.otherViewer, { label: 'Round', type: 'text' })).resolves.toBeDefined();
  });

  it('renames without changing the key', async () => {
    const updated = await updateFieldDefinition(f.db, f.viewer, f.fieldIds.round, { label: 'Funding round' });
    expect(updated).toMatchObject({ label: 'Funding round', key: 'round' });
  });

  it('hides archived fields unless asked', async () => {
    await setFieldArchived(f.db, f.viewer, f.fieldIds.closeDate, true);
    expect((await listFieldDefinitions(f.db, f.viewer.orgId)).map((d) => d.key)).toEqual(['round', 'arr_growth']);
    expect(await listFieldDefinitions(f.db, f.viewer.orgId, true)).toHaveLength(3);
  });

  it('cannot touch fields of another organisation', async () => {
    await expect(setFieldArchived(f.db, f.otherViewer, f.fieldIds.round, true)).rejects.toThrow(/not found/);
  });
});
