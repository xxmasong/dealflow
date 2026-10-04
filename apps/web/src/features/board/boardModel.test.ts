import { describe, expect, it } from 'vitest';
import type { BoardDeal, Stage } from '../../graphql/types';
import { applyMove, buildColumns, planMove } from './boardModel';

const stage = (id: string, position: number): Stage => ({ id, name: id, position, isWon: false, isLost: false });
const deal = (id: string, stageId: string, position: string): BoardDeal => ({
  id,
  name: id,
  company: id,
  amountCents: 0,
  currency: 'USD',
  position,
  updatedAt: '2026-01-01T00:00:00Z',
  stage: { id: stageId },
  owner: null,
  fields: [],
});

const stages = [stage('lead', 0), stage('won', 1)];
const deals = [deal('b', 'lead', 'r'), deal('a', 'lead', 'i'), deal('c', 'lead', 'v'), deal('x', 'won', 'i')];

describe('board model', () => {
  it('groups and sorts columns, keeping empty stages', () => {
    const columns = buildColumns([...stages, stage('lost', 2)], deals);
    expect(columns.lead!.map((d) => d.id)).toEqual(['a', 'b', 'c']);
    expect(columns.lost).toEqual([]);
  });

  it('plans a move into another column between two cards', () => {
    const columns = buildColumns(stages, deals);
    const plan = planMove(columns, 'x', { stageId: 'lead', index: 1 });
    expect(plan).toMatchObject({ afterDealId: 'a', beforeDealId: 'b', stageId: 'lead' });
    expect(plan!.position > 'i' && plan!.position < 'r').toBe(true);

    const moved = buildColumns(stages, applyMove(deals, plan!));
    expect(moved.lead!.map((d) => d.id)).toEqual(['a', 'x', 'b', 'c']);
    expect(moved.won).toEqual([]);
  });

  it('plans moves to the top and bottom of a column', () => {
    const columns = buildColumns(stages, deals);
    expect(planMove(columns, 'c', { stageId: 'lead', index: 0 })).toMatchObject({
      afterDealId: null,
      beforeDealId: 'a',
    });
    expect(planMove(columns, 'a', { stageId: 'won', index: 5 })).toMatchObject({
      afterDealId: 'x',
      beforeDealId: null,
    });
  });

  it('ignores a drop on the same spot', () => {
    const columns = buildColumns(stages, deals);
    expect(planMove(columns, 'b', { stageId: 'lead', index: 1 })).toBeNull();
  });
});
