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

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }
  const value = await fn();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}
