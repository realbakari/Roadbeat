import { createHash } from 'node:crypto'

// The visitor count's arithmetic, kept pure so it can be tested: which day
// and 5-minute window a moment falls in, the Redis keys for them, and the id
// a browser is counted under.

/** A window of "online now": browsers that pinged within this long count. */
export const WINDOW_MS = 5 * 60_000
/** "Online now" spans this many windows (the current one and the one before). */
const ONLINE_WINDOWS = 2

const brisbane = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' })

/** The Brisbane calendar date, YYYY-MM-DD, so "today" rolls over at local midnight. */
export function brisbaneDay(now: number): string {
  return brisbane.format(now)
}

/**
 * The id a browser is counted under for one day. It's a hash of the address,
 * the browser, the date and a server-side secret, so it tells visits apart
 * within a day but can't be turned back into the address and doesn't carry
 * over to the next day. It's only ever fed to a HyperLogLog, which keeps an
 * estimate of how many distinct ids it saw, not the ids.
 */
export function visitorId(ip: string, userAgent: string, day: string, salt: string): string {
  return createHash('sha256').update(`${salt}\n${day}\n${ip}\n${userAgent}`).digest('base64url').slice(0, 22)
}

export const dayKey = (day: string) => `visits:day:${day}`

export const windowKey = (now: number) => `visits:win:${Math.floor(now / WINDOW_MS)}`

/** The current window's key and the previous ones', newest first. */
export function recentWindowKeys(now: number, count = ONLINE_WINDOWS): string[] {
  const current = Math.floor(now / WINDOW_MS)
  return Array.from({ length: count }, (_, i) => `visits:win:${current - i}`)
}

/** The visitor's address as the host reports it: the first forwarded address, else the direct one. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  return (forwarded?.split(',')[0] ?? headers.get('x-real-ip') ?? '').trim()
}
