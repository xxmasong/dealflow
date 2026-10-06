import { GraphQLScalarType, Kind, type ValueNode } from 'graphql';
import { eq, asc } from 'drizzle-orm';
import { requireViewer, type Context } from '../context.js';
import { rateLimited } from '../lib/errors.js';
import { stages, users, type Deal, type DealHistoryEntry, type FieldDefinition, type Stage } from '../db/schema.js';
import * as dealService from '../services/deals.js';
import * as fieldService from '../services/fieldDefinitions.js';
import * as reports from '../services/reports.js';

function parseLiteral(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.NULL:
      return null;
    case Kind.LIST:
      return ast.values.map(parseLiteral);
    case Kind.OBJECT:
      return Object.fromEntries(ast.fields.map((f) => [f.name.value, parseLiteral(f.value)]));
    default:
      return undefined;
  }
}

const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  serialize: (v) => v,
  parseValue: (v) => v,
  parseLiteral,
});

const DateTime = new GraphQLScalarType({
  name: 'DateTime',
  serialize: (v) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString()),
});

export const resolvers = {
  JSON: JSONScalar,
  DateTime,

  Query: {
    me: async (_: unknown, __: unknown, ctx: Context) => {
      const viewer = requireViewer(ctx);
      return ctx.loaders.user.load(viewer.id);
    },
    users: (_: unknown, __: unknown, ctx: Context) => {
      const viewer = requireViewer(ctx);
      return ctx.db.select().from(users).where(eq(users.orgId, viewer.orgId)).orderBy(asc(users.name));
    },
    stages: (_: unknown, __: unknown, ctx: Context) => {
      const viewer = requireViewer(ctx);
      return ctx.db.select().from(stages).where(eq(stages.orgId, viewer.orgId)).orderBy(asc(stages.position));
    },
    deals: (_: unknown, args: { stageId?: string | null; search?: string | null }, ctx: Context) =>
      dealService.listDeals(ctx.db, requireViewer(ctx).orgId, args),
    deal: (_: unknown, args: { id: string }, ctx: Context) =>
      dealService.getDeal(ctx.db, requireViewer(ctx).orgId, args.id),
    fieldDefinitions: (_: unknown, args: { includeArchived?: boolean }, ctx: Context) =>
      fieldService.listFieldDefinitions(ctx.db, requireViewer(ctx).orgId, args.includeArchived ?? false),
    report: (_: unknown, __: unknown, ctx: Context) => ({ orgId: requireViewer(ctx).orgId }),
  },

  Mutation: {
    login: (_: unknown, args: { email: string; password: string }, ctx: Context) => {
      if (!ctx.auth.allowSignIn(ctx.clientKey)) {
        throw rateLimited('Too many sign-in attempts. Try again in a minute.');
      }
      return ctx.auth.login(ctx.db, args.email, args.password);
    },
    createDeal: (_: unknown, args: { input: unknown }, ctx: Context) =>
      dealService.createDeal(ctx.db, requireViewer(ctx), args.input),
    updateDeal: (_: unknown, args: { id: string; input: unknown }, ctx: Context) =>
      dealService.updateDeal(ctx.db, requireViewer(ctx), args.id, args.input),
    moveDeal: (
      _: unknown,
      args: { id: string; stageId: string; afterDealId?: string | null; beforeDealId?: string | null },
      ctx: Context,
    ) => dealService.moveDeal(ctx.db, requireViewer(ctx), { ...args, dealId: args.id }),
    setFieldValue: async (_: unknown, args: { dealId: string; fieldId: string; value: unknown }, ctx: Context) => {
      const viewer = requireViewer(ctx);
      await dealService.setFieldValue(ctx.db, viewer, args);
      return dealService.getDeal(ctx.db, viewer.orgId, args.dealId);
    },
    createField: (_: unknown, args: { input: unknown }, ctx: Context) =>
      fieldService.createFieldDefinition(ctx.db, requireViewer(ctx), args.input),
    updateField: (_: unknown, args: { id: string; input: unknown }, ctx: Context) =>
      fieldService.updateFieldDefinition(ctx.db, requireViewer(ctx), args.id, args.input),
    archiveField: (_: unknown, args: { id: string; archived?: boolean }, ctx: Context) =>
      fieldService.setFieldArchived(ctx.db, requireViewer(ctx), args.id, args.archived ?? true),
  },

  Deal: {
    stage: (deal: Deal, _: unknown, ctx: Context) => ctx.loaders.stage.load(deal.stageId),
    owner: (deal: Deal, _: unknown, ctx: Context) => (deal.ownerId ? ctx.loaders.user.load(deal.ownerId) : null),
    fields: async (deal: Deal, _: unknown, ctx: Context) => {
      const values = await ctx.loaders.fieldValues.load(deal.id);
      const resolved = await Promise.all(
        values.map(async (v) => ({ field: await ctx.loaders.field.load(v.fieldId), value: v.value })),
      );
      return resolved.filter((r): r is { field: FieldDefinition; value: string | number | null } => r.field !== null);
    },
    history: (deal: Deal, _: unknown, ctx: Context) => dealService.historyFor(ctx.db, deal.orgId, deal.id),
  },

  HistoryEntry: {
    actor: (entry: DealHistoryEntry, _: unknown, ctx: Context) =>
      entry.actorId ? ctx.loaders.user.load(entry.actorId) : null,
  },

  PipelineReport: {
    stages: async ({ orgId }: { orgId: string }, _: unknown, ctx: Context) => {
      const rows = await reports.pipelineSummary(ctx.db, orgId);
      const all = await Promise.all(rows.map((r) => ctx.loaders.stage.load(r.stageId)));
      return rows.map((r, i) => ({ stage: all[i] as Stage, dealCount: r.dealCount, amountCents: r.amountCents }));
    },
    flows: ({ orgId }: { orgId: string }, args: { days: number }, ctx: Context) =>
      reports.stageFlows(ctx.db, orgId, clampDays(args.days)),
    activity: ({ orgId }: { orgId: string }, args: { days: number }, ctx: Context) =>
      reports.activityByDay(ctx.db, orgId, clampDays(args.days)),
    winRate: ({ orgId }: { orgId: string }, _: unknown, ctx: Context) => reports.winRate(ctx.db, orgId),
  },
};

const clampDays = (days: number) => Math.min(Math.max(Math.trunc(days), 1), 365);
