import type { Db } from './db/client.js';
import { unauthenticated } from './lib/errors.js';

export interface Viewer {
  id: string;
  orgId: string;
}

export interface Context {
  db: Db;
  viewer: Viewer | null;
}

export function requireViewer(ctx: Context): Viewer {
  if (!ctx.viewer) throw unauthenticated();
  return ctx.viewer;
}
