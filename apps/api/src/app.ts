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
}

export function createApp({ db, jwtSecret, corsOrigin, graphiql = false }: AppOptions) {
  const auth = createAuth(jwtSecret);
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
    }),
  });
}
