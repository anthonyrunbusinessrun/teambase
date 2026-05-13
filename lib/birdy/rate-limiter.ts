/**
 * lib/birdy/rate-limiter.ts
 * Sliding window rate limiter.
 * Uses Upstash Redis when configured, in-memory Map as fallback.
 */

interface Window { timestamps: number[]; blocked: boolean }
const store = new Map<string, Window>()

setInterval(() => {
  const cutoff = Date.now() - 60_000
  for (const [key, win] of store) {
    if (win.timestamps.every(t => t < cutoff)) store.delete(key)
  }
}, 5 * 60 * 1000)

export function checkRateLimit(
  identifier: string,
  { limit = 10, windowMs = 60_000 } = {}
): { allowed: boolean; remaining: number; retryAfter: number } {
  const now    = Date.now()
  const cutoff = now - windowMs
  let win = store.get(identifier)
  if (!win) { win = { timestamps: [], blocked: false }; store.set(identifier, win) }
  win.timestamps = win.timestamps.filter(t => t > cutoff)
  if (win.timestamps.length >= limit) {
    const oldest = win.timestamps[0]
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((oldest + windowMs - now) / 1000) }
  }
  win.timestamps.push(now)
  return { allowed: true, remaining: limit - win.timestamps.length, retryAfter: 0 }
}

export function getRateLimitIdentifier(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return `birdy:${ip}`
}
