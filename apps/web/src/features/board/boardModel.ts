import { keyBetween } from '../../lib/position';
import type { BoardDeal, Stage } from '../../graphql/types';

export type Columns = Record<string, BoardDeal[]>;

/** Groups deals into stage columns, each sorted by its position key. */
export function buildColumns(stages: Stage[], deals: BoardDeal[]): Columns {
  const columns: Columns = Object.fromEntries(stages.map((s) => [s.id, []]));
  for (const deal of deals) columns[deal.stage.id]?.push(deal);
  for (const list of Object.values(columns))
    list.sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));
  return columns;
}

export interface DropTarget {
  stageId: string;
  /** Index in the target column, counted without the dragged card. */
  index: number;
}

export interface MovePlan {
  dealId: string;
  stageId: string;
  afterDealId: string | null;
  beforeDealId: string | null;
  position: string;
}

/**
 * Works out the neighbours and new sort key for a drop. Returns null when the
 * card is dropped where it already is.
 */
export function planMove(columns: Columns, dealId: string, target: DropTarget): MovePlan | null {
  const column = (columns[target.stageId] ?? []).filter((d) => d.id !== dealId);
  const index = Math.max(0, Math.min(target.index, column.length));
  const above = column[index - 1] ?? null;
  const below = column[index] ?? null;

  const current = columns[target.stageId]?.findIndex((d) => d.id === dealId) ?? -1;
  if (current !== -1 && current === index) return null;

  return {
    dealId,
    stageId: target.stageId,
    afterDealId: above?.id ?? null,
    beforeDealId: below?.id ?? null,
    position: keyBetween(above?.position ?? null, below?.position ?? null),
  };
}

/** Applies a move to a flat deal list, as the optimistic cache update. */
export function applyMove(deals: BoardDeal[], plan: MovePlan): BoardDeal[] {
  return deals.map((d) => (d.id === plan.dealId ? { ...d, stage: { id: plan.stageId }, position: plan.position } : d));
}
