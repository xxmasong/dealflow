import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStaticHandler } from './static.js';

let server: Server;
let base: string;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'dealflow-static-'));
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'index.html'), '<!doctype html><p>app</p>');
  await writeFile(join(root, 'assets', 'app-123.js'), 'console.log(1)');
  const handle = createStaticHandler(root);
  server = createServer((req, res) => {
    void handle(req, res).then((ok) => ok || res.writeHead(404).end());
  });
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('static handler', () => {
  it('serves fingerprinted assets with a long cache', async () => {
    const res = await fetch(`${base}/assets/app-123.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
    expect(res.headers.get('cache-control')).toContain('immutable');
  });

  it('falls back to index.html for client routes', async () => {
    const res = await fetch(`${base}/board?deal=1`);
    expect(await res.text()).toContain('<p>app</p>');
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('does not escape the root folder', async () => {
    const res = await fetch(`${base}/..%2f..%2fetc%2fpasswd`);
    expect([403, 200]).toContain(res.status);
    expect(await res.text()).not.toContain('root:');
  });
});
