/**
 * Fixed-window rate limiter, in memory.
 *
 * Enough for a single instance; a multi-instance deployment would move the
 * counters to Redis behind the same interface.
 */
export interface RateLimiter {
  /** Returns false when the caller has used up its allowance for the window. */
  take: (key: string) => boolean;
  stop: () => void;
}

export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Sweep expired entries so a flood of distinct keys cannot grow the map
  // without bound. unref() keeps the timer from holding the process open.
  const sweep = setInterval(() => {
    const t = now();
    for (const [key, entry] of hits) if (entry.resetAt <= t) hits.delete(key);
  }, windowMs);
  sweep.unref?.();

  return {
    take(key) {
      const t = now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= t) {
        hits.set(key, { count: 1, resetAt: t + windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= limit;
    },
    stop: () => clearInterval(sweep),
  };
}
