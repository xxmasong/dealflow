import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

/**
 * Serves the built web app from `root`, falling back to index.html so
 * client-side routes work on reload. Returns false if the request is not a GET/HEAD.
 */
export function createStaticHandler(root: string) {
  const base = resolve(root);
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = normalize(join(base, pathname));
    if (file !== base && !file.startsWith(base + sep)) {
      res.writeHead(403).end();
      return true;
    }

    let info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      file = join(base, 'index.html');
      info = await stat(file).catch(() => null);
      if (!info) return false;
    }

    const hashed = file.includes(`${sep}assets${sep}`);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'content-length': info.size,
      // Vite fingerprints everything under /assets, so those can be cached forever.
      'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
    return true;
  };
}
