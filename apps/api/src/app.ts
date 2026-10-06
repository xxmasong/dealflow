import { createSchema, createYoga } from 'graphql-yoga';
import { createAuth } from './auth.js';
import type { Context } from './context.js';
import type { Db } from './db/client.js';
import { createLoaders } from './graphql/loaders.js';
import { resolvers } from './graphql/resolvers.js';
import { typeDefs } from './graphql/typeDefs.js';

export interface AppOptions {
  db: Db;
  jwtSecret: string;
  corsOrigin?: string;
  /** Show GraphiQL at /graphql (development only). */
  graphiql?: boolean;
  /** Sign-in attempts allowed per client address per minute. */
  signInLimit?: number;
}

/** Client address for rate limiting, honouring one proxy hop in front of us. */
function clientKeyFor(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

export function createApp({ db, jwtSecret, corsOrigin, graphiql = false, signInLimit }: AppOptions) {
  const auth = createAuth(jwtSecret, { signInLimit });
  return createYoga<object, Context>({
    schema: createSchema<Context>({ typeDefs, resolvers }),
    graphiql,
    cors: corsOrigin ? { origin: corsOrigin.split(','), credentials: false } : false,
    // Unexpected errors are masked; errors from lib/errors.ts pass through
    // with their message and code.
    maskedErrors: true,
    context: async ({ request }) => ({
      db,
      auth,
      viewer: await auth.viewerFromHeader(request.headers.get('authorization')),
      loaders: createLoaders(db),
      clientKey: clientKeyFor(request),
    }),
  });
}
