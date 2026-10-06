import { beforeAll, describe, expect, it } from 'vitest';
import { afterAll } from 'vitest';
import { createApp } from './app.js';
import { openDatabase, type Database } from './db/client.js';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemo } from './db/seed.js';

let database: Database;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  database = await openDatabase('memory://');
  await seedDemo(database.db);
  await seedDemo(database.db); // idempotent
  app = createApp({ db: database.db, jwtSecret: 'integration-test-secret-0123456789', signInLimit: 5 });
});
afterAll(async () => {
  await database.close();
});

async function gql(query: string, variables: Record<string, unknown> = {}, token?: string) {
  const res = await app.fetch('http://test/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()) as { data?: any; errors?: Array<{ message: string; extensions?: { code?: string } }> };
}

async function signIn() {
  const r = await gql(`mutation($e: String!, $p: String!) { login(email: $e, password: $p) { token user { name } } }`, {
    e: DEMO_EMAIL,
    p: DEMO_PASSWORD,
  });
  return r.data.login.token as string;
}

describe('GraphQL API', () => {
  it('requires sign-in', async () => {
    const r = await gql('{ deals { id } }');
    expect(r.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('serves the demo board with stages, owners and custom fields', async () => {
    const token = await signIn();
    const r = await gql(
      `{ me { name } stages { id name } deals { id company stage { name } owner { name } fields { field { key } value } } }`,
      {},
      token,
    );
    expect(r.errors).toBeUndefined();
    expect(r.data.me.name).toBe('Demo Partner');
    expect(r.data.stages).toHaveLength(6);
    expect(r.data.deals).toHaveLength(30);
    expect(r.data.deals[0].fields.map((f: any) => f.field.key)).toContain('round');
  });

  it('moves a deal and exposes the change in its history and the report', async () => {
    const token = await signIn();
    const board = await gql(`{ stages { id name } deals { id stage { id } } }`, {}, token);
    const target = board.data.stages.find((s: any) => s.name === 'Term sheet');
    const deal = board.data.deals.find((d: any) => d.stage.id !== target.id);

    const moved = await gql(
      `mutation($id: ID!, $s: ID!) { moveDeal(id: $id, stageId: $s) { stage { name } history { kind newValue } } }`,
      { id: deal.id, s: target.id },
      token,
    );
    expect(moved.data.moveDeal.stage.name).toBe('Term sheet');
    expect(moved.data.moveDeal.history[0]).toMatchObject({ kind: 'stage_changed', newValue: { name: 'Term sheet' } });

    const report = await gql(
      `{ report { winRate stages { stage { name } dealCount } activity(days: 7) { moved } } }`,
      {},
      token,
    );
    expect(report.errors).toBeUndefined();
    expect(report.data.report.stages).toHaveLength(6);
    expect(report.data.report.activity.at(-1).moved).toBeGreaterThanOrEqual(1);
  });

  it('returns validation messages as BAD_USER_INPUT', async () => {
    const token = await signIn();
    const { data } = await gql(`{ stages { id } }`, {}, token);
    const r = await gql(
      `mutation($s: ID!) { createDeal(input: { name: "", company: "X", stageId: $s }) { id } }`,
      { s: data.stages[0].id },
      token,
    );
    expect(r.errors?.[0]).toMatchObject({ message: 'Name is required', extensions: { code: 'BAD_USER_INPUT' } });
  });

  it('rejects a wrong password', async () => {
    const r = await gql(`mutation { login(email: "${DEMO_EMAIL}", password: "nope") { token } }`);
    expect(r.errors?.[0]?.message).toBe('Incorrect email or password');
  });

  it('rate limits repeated sign-in attempts from one address', async () => {
    const attempt = async () => {
      const res = await app.fetch('http://test/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
        body: JSON.stringify({ query: `mutation { login(email: "x@y.test", password: "nope") { token } }` }),
      });
      return (await res.json()) as { errors?: Array<{ extensions?: { code?: string } }> };
    };

    const codes: Array<string | undefined> = [];
    for (let i = 0; i < 7; i++) codes.push((await attempt()).errors?.[0]?.extensions?.code);
    expect(codes.slice(0, 5)).toEqual(Array(5).fill('UNAUTHENTICATED'));
    expect(codes.at(-1)).toBe('RATE_LIMITED');
  });
});
