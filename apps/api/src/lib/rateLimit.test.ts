import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit.js';

describe('createRateLimiter', () => {
  it('allows up to the limit then blocks within a window', () => {
    let t = 0;
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000, now: () => t });
    expect([limiter.take('a'), limiter.take('a'), limiter.take('a')]).toEqual([true, true, true]);
    expect(limiter.take('a')).toBe(false);
    limiter.stop();
  });

  it('counts each key separately', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('b')).toBe(true);
    expect(limiter.take('a')).toBe(false);
    limiter.stop();
  });

  it('starts a new window once the old one expires', () => {
    let t = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t });
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(false);
    t = 1000;
    expect(limiter.take('a')).toBe(true);
    limiter.stop();
  });
});
