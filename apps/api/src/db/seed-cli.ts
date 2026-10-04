import { loadConfig } from '../config.js';
import { openDatabase } from './client.js';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemo } from './seed.js';

const config = loadConfig({ JWT_SECRET: 'x'.repeat(32), ...process.env });
const { db, close } = await openDatabase(config.DATABASE_URL);
await seedDemo(db);
await close();
console.log(`Demo data ready. Sign in as ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
