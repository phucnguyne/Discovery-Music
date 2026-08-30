// apps/api/src/lib/rate-limit.ts
//
// In-process, per-key sliding-window limiter — same "not Redis yet"
// tradeoff as cache.ts (see that file's comment). Fine for one API
// instance; if @music/api ever runs behind a load balancer, this needs to
// move to a shared store (Redis INCR+EXPIRE) same as the cache does.
interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

/** Returns true if `key` is still under `max` hits within `windowMs`,
 * recording this call as one of them. Used to slow down login-guessing
 * without needing a captcha or a shared store yet. */
export function withinRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= max;
}