import type { Auth } from './auth.js';
import type { Db } from './db/client.js';
import type { Loaders } from './graphql/loaders.js';
import { unauthenticated } from './lib/errors.js';

export interface Viewer {
  id: string;
  orgId: string;
}

export interface Context {
  db: Db;
  auth: Auth;
  viewer: Viewer | null;
  loaders: Loaders;
  /** Caller identity for rate limiting: the proxy-forwarded client address. */
  clientKey: string;
}

export function requireViewer(ctx: Context): Viewer {
  if (!ctx.viewer) throw unauthenticated();
  return ctx.viewer;
}
