import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { useFixture, type Fixture } from '../test/helpers.js';
import { createAuth, hashPassword } from './auth.js';
import { users } from './db/schema.js';

const auth = createAuth('test-secret-that-is-long-enough-for-hs256');
const fixture = useFixture();
let f: Fixture;
beforeEach(() => {
  f = fixture();
});

describe('auth', () => {
  it('issues a token that resolves back to the viewer', async () => {
    const token = await auth.issueToken(f.viewer);
    expect(await auth.viewerFromHeader(`Bearer ${token}`)).toEqual(f.viewer);
  });

  it('rejects missing, malformed and foreign tokens', async () => {
    const other = createAuth('a-completely-different-secret-value-123');
    expect(await auth.viewerFromHeader(null)).toBeNull();
    expect(await auth.viewerFromHeader('Bearer not-a-jwt')).toBeNull();
    expect(await auth.viewerFromHeader(`Bearer ${await other.issueToken(f.viewer)}`)).toBeNull();
  });

  it('logs in with the right password only', async () => {
    const [user] = await f.db
      .update(users)
      .set({ passwordHash: await hashPassword('correct horse') })
      .where(eq(users.id, f.viewer.id))
      .returning();

    const { token } = await auth.login(f.db, user!.email.toUpperCase(), 'correct horse');
    expect(await auth.viewerFromHeader(`Bearer ${token}`)).toEqual(f.viewer);
    await expect(auth.login(f.db, user!.email, 'wrong')).rejects.toThrow(/Incorrect email or password/);
    await expect(auth.login(f.db, 'nobody@example.com', 'x')).rejects.toThrow(/Incorrect email or password/);
  });
});
