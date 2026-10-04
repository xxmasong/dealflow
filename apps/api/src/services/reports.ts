import { and, asc, count, eq, gte, sql, sum } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { dealHistory, deals, stages } from '../db/schema.js';

export interface StageSummary {
  stageId: string;
  name: string;
  isWon: boolean;
  isLost: boolean;
  dealCount: number;
  amountCents: number;
}

/** Deal count and total value per stage, in pipeline order (empty stages included). */
export async function pipelineSummary(db: Db, orgId: string): Promise<StageSummary[]> {
  const rows = await db
    .select({
      stageId: stages.id,
      name: stages.name,
      isWon: stages.isWon,
      isLost: stages.isLost,
      dealCount: count(deals.id),
      amountCents: sum(deals.amountCents),
    })
    .from(stages)
    .leftJoin(deals, eq(deals.stageId, stages.id))
    .where(eq(stages.orgId, orgId))
    .groupBy(stages.id)
    .orderBy(asc(stages.position));

  return rows.map((r) => ({ ...r, dealCount: Number(r.dealCount), amountCents: Number(r.amountCents ?? 0) }));
}

export interface StageFlow {
  fromStage: string | null;
  toStage: string;
  count: number;
}

/** How many deals moved between each pair of stages in the last `days` days. */
export async function stageFlows(db: Db, orgId: string, days: number): Promise<StageFlow[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const from = sql<string | null>`${dealHistory.oldValue}->>'name'`;
  const to = sql<string>`${dealHistory.newValue}->>'name'`;
  const rows = await db
    .select({ fromStage: from, toStage: to, count: count() })
    .from(dealHistory)
    .where(and(eq(dealHistory.orgId, orgId), eq(dealHistory.kind, 'stage_changed'), gte(dealHistory.createdAt, since)))
    .groupBy(from, to)
    .orderBy(sql`count(*) desc`);
  return rows.map((r) => ({ ...r, count: Number(r.count) }));
}

export interface ActivityPoint {
  date: string;
  created: number;
  moved: number;
  edited: number;
}

/** Daily counts of deal activity for the last `days` days, with zero-filled gaps. */
export async function activityByDay(db: Db, orgId: string, days: number): Promise<ActivityPoint[]> {
  const since = new Date(Date.now() - (days - 1) * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  const day = sql<string>`to_char(${dealHistory.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day, kind: dealHistory.kind, count: count() })
    .from(dealHistory)
    .where(and(eq(dealHistory.orgId, orgId), gte(dealHistory.createdAt, since)))
    .groupBy(day, dealHistory.kind);

  const points = new Map<string, ActivityPoint>();
  for (let i = 0; i < days; i++) {
    const date = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    points.set(date, { date, created: 0, moved: 0, edited: 0 });
  }
  for (const r of rows) {
    const p = points.get(r.day);
    if (!p) continue;
    const n = Number(r.count);
    if (r.kind === 'created') p.created += n;
    else if (r.kind === 'stage_changed') p.moved += n;
    else p.edited += n;
  }
  return [...points.values()];
}

/** Won / (won + lost), counted on deals currently sitting in a closed stage. */
export async function winRate(db: Db, orgId: string): Promise<number | null> {
  const summary = await pipelineSummary(db, orgId);
  const won = summary.filter((s) => s.isWon).reduce((a, s) => a + s.dealCount, 0);
  const lost = summary.filter((s) => s.isLost).reduce((a, s) => a + s.dealCount, 0);
  return won + lost === 0 ? null : won / (won + lost);
}
