import { isIP } from 'node:net';
import type { Context } from 'hono';

interface Bucket {
  count: number;
  windowStart: number;
  windowMs: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 20_000;
let callsSinceCleanup = 0;

/** The ingress proxy must append the connecting address to X-Forwarded-For.
 * Use the last valid address, not the first (which a caller can often spoof). */
export function clientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (!forwarded) return 'unknown';

  const addresses = forwarded.split(',').map((address) => address.trim());
  for (let i = addresses.length - 1; i >= 0; i -= 1) {
    const address = addresses[i];
    if (address && isIP(address) !== 0) return address;
  }
  return 'unknown';
}

/** Returns true when `key` is under `max` hits in the window and records
 * this call. Periodic pruning and a hard cap prevent unbounded key growth. */
export function withinRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  callsSinceCleanup += 1;
  if (callsSinceCleanup >= 256) {
    callsSinceCleanup = 0;
    for (const [bucketKey, bucket] of buckets) {
      if (now - bucket.windowStart >= bucket.windowMs) buckets.delete(bucketKey);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= bucket.windowMs) {
    if (buckets.size >= MAX_BUCKETS) return false;
    buckets.set(key, { count: 1, windowStart: now, windowMs });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= max;
}
