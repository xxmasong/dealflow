import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import type { Viewer } from './context.js';
import type { Db } from './db/client.js';
import { users } from './db/schema.js';
import { AppError } from './lib/errors.js';

const ISSUER = 'dealflow';
const TOKEN_TTL = '12h';

export const hashPassword = (password: string) => bcrypt.hash(password, 12);

export function createAuth(secret: string) {
  const key = new TextEncoder().encode(secret);

  async function issueToken(viewer: Viewer): Promise<string> {
    return new SignJWT({ org: viewer.orgId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(viewer.id)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(TOKEN_TTL)
      .sign(key);
  }

  /** Returns the viewer for a valid bearer token, or null for anything else. */
  async function viewerFromHeader(header: string | null): Promise<Viewer | null> {
    const token = header?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, key, { issuer: ISSUER, algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || typeof payload.org !== 'string') return null;
      return { id: payload.sub, orgId: payload.org };
    } catch {
      return null;
    }
  }

  async function login(db: Db, email: string, password: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
    // Compare against a dummy hash when the user is missing so response time
    // doesn't reveal which emails exist.
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new AppError('Incorrect email or password', 'UNAUTHENTICATED');
    return { token: await issueToken({ id: user.id, orgId: user.orgId }), user };
  }

  return { issueToken, viewerFromHeader, login };
}

export type Auth = ReturnType<typeof createAuth>;

const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7ZpQ8jM1nEtY8nJYxWg1vB7v7Qy3bUe';
