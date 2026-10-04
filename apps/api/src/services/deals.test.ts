import { beforeEach, describe, expect, it } from 'vitest';
import { useFixture, type Fixture } from '../../test/helpers.js';
import { createDeal, historyFor, listDeals, moveDeal, setFieldValue, updateDeal } from './deals.js';

const fixture = useFixture();
let f: Fixture;
beforeEach(() => {
  f = fixture();
});

const newDeal = (stageId: string, name = 'Northwind', extra: Record<string, unknown> = {}) =>
  createDeal(f.db, f.viewer, { name, company: `${name} Inc`, amountCents: 500_000_00, stageId, ...extra });

describe('createDeal', () => {
  it('appends to the end of the stage and records a created entry', async () => {
    const a = await newDeal(f.stageIds.lead, 'A');
    const b = await newDeal(f.stageIds.lead, 'B');
    expect(a.position < b.position).toBe(true);

    const history = await historyFor(f.db, f.viewer.orgId, a.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ kind: 'created', actorId: f.viewer.id });
  });

  it('validates input', async () => {
    await expect(newDeal(f.stageIds.lead, '')).rejects.toThrow(/Name is required/);
    await expect(newDeal(f.stageIds.lead, 'X', { currency: 'usd' })).rejects.toThrow(/3-letter/);
  });

  it('refuses stages from another organisation', async () => {
    await expect(createDeal(f.db, f.otherViewer, { name: 'X', company: 'Y', stageId: f.stageIds.lead })).rejects.toThrow(
      /Stage not found/,
    );
  });
});

describe('updateDeal', () => {
  it('writes one history entry per changed attribute', async () => {
    const deal = await newDeal(f.stageIds.lead);
    await updateDeal(f.db, f.viewer, deal.id, { amountCents: 750_000_00, name: deal.name, company: 'Northwind Labs' });

    const entries = (await historyFor(f.db, f.viewer.orgId, deal.id)).filter((h) => h.kind === 'attribute_changed');
    expect(entries.map((e) => [e.field, e.oldValue, e.newValue]).sort()).toEqual([
      ['amountCents', 500_000_00, 750_000_00],
      ['company', 'Northwind Inc', 'Northwind Labs'],
    ]);
  });

  it('is a no-op when nothing changes', async () => {
    const deal = await newDeal(f.stageIds.lead);
    await updateDeal(f.db, f.viewer, deal.id, { name: deal.name });
    expect(await historyFor(f.db, f.viewer.orgId, deal.id)).toHaveLength(1);
  });

  it('hides deals from other organisations', async () => {
    const deal = await newDeal(f.stageIds.lead);
    await expect(updateDeal(f.db, f.otherViewer, deal.id, { name: 'Hijack' })).rejects.toThrow(/Deal not found/);
  });
});

describe('moveDeal', () => {
  it('places a deal between two neighbours in another stage and logs the stage change', async () => {
    const top = await newDeal(f.stageIds.qualified, 'Top');
    const bottom = await newDeal(f.stageIds.qualified, 'Bottom');
    const mover = await newDeal(f.stageIds.lead, 'Mover');

    await moveDeal(f.db, f.viewer, {
      dealId: mover.id,
      stageId: f.stageIds.qualified,
      afterDealId: top.id,
      beforeDealId: bottom.id,
    });

    const column = await listDeals(f.db, f.viewer.orgId, { stageId: f.stageIds.qualified });
    expect(column.map((d) => d.name)).toEqual(['Top', 'Mover', 'Bottom']);

    const [latest] = await historyFor(f.db, f.viewer.orgId, mover.id);
    expect(latest).toMatchObject({
      kind: 'stage_changed',
      oldValue: { id: f.stageIds.lead, name: 'Lead' },
      newValue: { id: f.stageIds.qualified, name: 'Qualified' },
    });
  });

  it('works out the missing neighbour itself', async () => {
    const a = await newDeal(f.stageIds.lead, 'A');
    const b = await newDeal(f.stageIds.lead, 'B');
    const c = await newDeal(f.stageIds.lead, 'C');

    // Drop C just below A without telling the server about B.
    await moveDeal(f.db, f.viewer, { dealId: c.id, stageId: f.stageIds.lead, afterDealId: a.id });
    const names = (await listDeals(f.db, f.viewer.orgId, { stageId: f.stageIds.lead })).map((d) => d.name);
    expect(names).toEqual(['A', 'C', 'B']);
    expect(b).toBeDefined();
  });

  it('does not log history for reordering inside a stage', async () => {
    const a = await newDeal(f.stageIds.lead, 'A');
    const b = await newDeal(f.stageIds.lead, 'B');
    await moveDeal(f.db, f.viewer, { dealId: b.id, stageId: f.stageIds.lead, beforeDealId: a.id });
    expect((await historyFor(f.db, f.viewer.orgId, b.id)).map((h) => h.kind)).toEqual(['created']);
  });

  it('rejects neighbours from a different stage', async () => {
    const a = await newDeal(f.stageIds.lead, 'A');
    const b = await newDeal(f.stageIds.proposal, 'B');
    await expect(
      moveDeal(f.db, f.viewer, { dealId: a.id, stageId: f.stageIds.qualified, afterDealId: b.id }),
    ).rejects.toThrow(/different stage/);
  });
});

describe('setFieldValue', () => {
  it('stores validated values and records old and new values', async () => {
    const deal = await newDeal(f.stageIds.lead);
    await setFieldValue(f.db, f.viewer, { dealId: deal.id, fieldId: f.fieldIds.arrGrowth, value: '42' });
    await setFieldValue(f.db, f.viewer, { dealId: deal.id, fieldId: f.fieldIds.arrGrowth, value: 55 });

    const entries = (await historyFor(f.db, f.viewer.orgId, deal.id)).filter((h) => h.kind === 'field_changed');
    expect(entries.map((e) => [e.field, e.oldValue, e.newValue])).toEqual([
      ['arr_growth', 42, 55],
      ['arr_growth', null, 42],
    ]);
  });

  it('skips history when the value is unchanged', async () => {
    const deal = await newDeal(f.stageIds.lead);
    await setFieldValue(f.db, f.viewer, { dealId: deal.id, fieldId: f.fieldIds.round, value: 'Seed' });
    await setFieldValue(f.db, f.viewer, { dealId: deal.id, fieldId: f.fieldIds.round, value: 'Seed' });
    expect((await historyFor(f.db, f.viewer.orgId, deal.id)).filter((h) => h.kind === 'field_changed')).toHaveLength(1);
  });

  it('rejects invalid values', async () => {
    const deal = await newDeal(f.stageIds.lead);
    await expect(
      setFieldValue(f.db, f.viewer, { dealId: deal.id, fieldId: f.fieldIds.round, value: 'Series Z' }),
    ).rejects.toThrow(/must be one of/);
  });
});

describe('listDeals', () => {
  it('searches name and company, case-insensitively, and escapes wildcards', async () => {
    await newDeal(f.stageIds.lead, 'Contoso');
    await newDeal(f.stageIds.lead, 'Fabrikam');
    expect((await listDeals(f.db, f.viewer.orgId, { search: 'conT' })).map((d) => d.name)).toEqual(['Contoso']);
    expect(await listDeals(f.db, f.viewer.orgId, { search: '%' })).toHaveLength(0);
  });
});
