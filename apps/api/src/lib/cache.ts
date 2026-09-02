// apps/api/src/lib/cache.ts
//
// Deliberately not Redis yet. The doc's own staging says start simple —
// this in-process cache buys the iTunes API some breathing room during
// dev/demo traffic. Swap for @music/cache-redis later without touching
// call sites: same get/set(ttl) shape.

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

/** Returns true when `v` looks like a meaningful result worth caching.
 *  Empty arrays, null, and undefined are treated as transient failures
 *  (e.g. iTunes was temporarily unreachable) and are NOT cached so the
 *  next request retries the upstream immediately instead of serving
 *  stale emptiness for the full TTL. */
function isCacheable(v: unknown): boolean {
  if (v == null) return false;
  if (Array.isArray(v) && v.length === 0) return false;
  // Genre/artist responses are objects with nested arrays — cache them
  // only when at least one nested array is non-empty.
  if (typeof v === 'object' && !Array.isArray(v)) {
    const vals = Object.values(v as Record<string, unknown>);
    const arrays = vals.filter(Array.isArray);
    if (arrays.length > 0 && arrays.every((a) => a.length === 0)) return false;
  }
  return true;
}

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }
  const value = await fn();
  if (isCacheable(value)) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
  return value;
}
