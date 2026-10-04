import { beforeEach, describe, expect, it } from 'vitest';
import { useFixture, type Fixture } from '../../test/helpers.js';
import { createDeal, moveDeal, updateDeal } from './deals.js';
import { activityByDay, pipelineSummary, stageFlows, winRate } from './reports.js';

const fixture = useFixture();
let f: Fixture;
beforeEach(() => {
  f = fixture();
});

async function deal(stageId: string, amountCents: number) {
  return createDeal(f.db, f.viewer, { name: 'D', company: 'C', amountCents, stageId });
}

describe('reports', () => {
  it('summarises every stage, including empty ones', async () => {
    await deal(f.stageIds.lead, 100);
    await deal(f.stageIds.lead, 250);
    await deal(f.stageIds.won, 1000);

    const summary = await pipelineSummary(f.db, f.viewer.orgId);
    expect(summary.map((s) => [s.name, s.dealCount, s.amountCents])).toEqual([
      ['Lead', 2, 350],
      ['Qualified', 0, 0],
      ['Proposal', 0, 0],
      ['Won', 1, 1000],
      ['Lost', 0, 0],
    ]);
  });

  it('computes win rate from closed stages', async () => {
    expect(await winRate(f.db, f.viewer.orgId)).toBeNull();
    await deal(f.stageIds.won, 1);
    await deal(f.stageIds.won, 1);
    await deal(f.stageIds.lost, 1);
    expect(await winRate(f.db, f.viewer.orgId)).toBeCloseTo(2 / 3);
  });

  it('counts stage flows and daily activity', async () => {
    const a = await deal(f.stageIds.lead, 1);
    const b = await deal(f.stageIds.lead, 1);
    await moveDeal(f.db, f.viewer, { dealId: a.id, stageId: f.stageIds.qualified });
    await moveDeal(f.db, f.viewer, { dealId: b.id, stageId: f.stageIds.qualified });
    await updateDeal(f.db, f.viewer, a.id, { amountCents: 5 });

    expect(await stageFlows(f.db, f.viewer.orgId, 30)).toEqual([{ fromStage: 'Lead', toStage: 'Qualified', count: 2 }]);

    const activity = await activityByDay(f.db, f.viewer.orgId, 7);
    expect(activity).toHaveLength(7);
    expect(activity.at(-1)).toMatchObject({ created: 2, moved: 2, edited: 1 });
    expect(activity[0]).toMatchObject({ created: 0, moved: 0, edited: 0 });
  });
});
