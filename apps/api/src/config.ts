import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().default('./.data/pglite'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /** Folder with the built web app to serve alongside the API (production). */
  WEB_DIST: z.string().optional(),
  SEED_DEMO: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** Restore the demo organisation on this interval, in minutes (0 = never). */
  DEMO_RESET_MINUTES: z.coerce.number().int().min(0).default(0),
});

export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  return parsed.data;
}
