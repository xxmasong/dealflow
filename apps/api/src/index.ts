import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db/client.js';
import { DEMO_EMAIL, seedDemo } from './db/seed.js';

const config = loadConfig();
const { db, close } = await openDatabase(config.DATABASE_URL);
if (config.SEED_DEMO) {
  await seedDemo(db);
  console.log(`Demo organisation available (${DEMO_EMAIL})`);
}

const yoga = createApp({
  db,
  jwtSecret: config.JWT_SECRET,
  corsOrigin: config.CORS_ORIGIN,
  graphiql: process.env.NODE_ENV !== 'production',
});

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
    return;
  }
  void yoga(req, res);
});

server.listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}${yoga.graphqlEndpoint}`);
});

const shutdown = () => {
  server.close(() => void close().then(() => process.exit(0)));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
