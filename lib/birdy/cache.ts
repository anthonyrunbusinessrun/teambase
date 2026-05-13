/**
 * lib/birdy/cache.ts
 * Lightweight in-process TTL cache.
 *
 * WHY THIS EXISTS:
 *   - getRoles() hits Airtable on EVERY Birdy message (to inject role context into the system prompt)
 *   - At 10 messages/user that's 10 Airtable API calls — slow and wasteful
 *   - This cache keeps the last result alive for `ttlMs` and deduplicates concurrent fetches
 *   - Also used to guard against DB query spikes
 *
 * LIMITS:
 *   - In-process only — works fine for Railway's single-instance deployment
 *   - If Railway scales to multiple instances, move to Upstash Redis (swap CacheEntry for Redis calls)
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
  pending: Promise<T> | null   // deduplication: only one in-flight fetch per key
}

const store = new Map<string, CacheEntry<unknown>>()

// Periodically sweep stale entries to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (!entry.pending && entry.expiresAt < now) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Get a cached value, or compute and cache it.
 *
 * @param key    - Cache key
 * @param ttlMs  - Time to live in milliseconds
 * @param fetch  - Async function that produces the value (only called on miss)
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fetch: () => Promise<T>,
): Promise<T> {
  const now = Date.now()
  const entry = store.get(key) as CacheEntry<T> | undefined

  // Cache hit — return immediately
  if (entry && entry.expiresAt > now && !entry.pending) {
    return entry.value
  }

  // Deduplicate: if a fetch is already in flight, wait for it
  if (entry?.pending) {
    return entry.pending
  }

  // Cache miss — start fetch, store the pending promise to prevent thundering herd
  const pending = fetch()
    .then(value => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs, pending: null })
      return value
    })
    .catch(err => {
      // On error: keep the stale value if we have one (fail open)
      if (entry) {
        store.set(key, { ...entry, pending: null, expiresAt: Date.now() + 10_000 })
        return entry.value
      }
      throw err
    })

  // Store pending promise immediately
  store.set(key, {
    value: entry?.value as T,
    expiresAt: entry?.expiresAt ?? 0,
    pending: pending as Promise<unknown>,
  })

  return pending
}

/**
 * Manually invalidate a cache entry (e.g. after a role update webhook).
 */
export function invalidate(key: string): void {
  store.delete(key)
}

/**
 * Return current cache size — useful for monitoring.
 */
export function cacheSize(): number {
  return store.size
}
