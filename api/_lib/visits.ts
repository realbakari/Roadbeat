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

/**
 * The key that marks a browser as already counted in the current window. The
 * first ping in a window sets it (SET NX), so further pings from that browser
 * in the window cost one Redis command instead of four.
 */
export const seenKey = (now: number, id: string) => `visits:seen:${Math.floor(now / WINDOW_MS)}:${id}`

/** The current window's key and the previous ones', newest first. */
export function recentWindowKeys(now: number, count = ONLINE_WINDOWS): string[] {
  const current = Math.floor(now / WINDOW_MS)
  return Array.from({ length: count }, (_, i) => `visits:win:${current - i}`)
}

/**
 * The Redis key that counts one address's requests of one kind (such as
 * "feedback") on one day, for a daily limit. It hashes like visitorId but leaves
 * the browser out, so sending a different browser name doesn't start a new count.
 */
export function rateKey(kind: string, ip: string, day: string, salt: string): string {
  return `${kind}:rate:${visitorId(addressBlock(ip), '', day, salt)}`
}

/** Whether a daily count read with Redis GET (a numeric string, or null before the first) is still under `limit`. */
export function hasRoom(stored: unknown, limit: number): boolean {
  const count = typeof stored === 'string' || typeof stored === 'number' ? Number(stored) : 0
  return !(count >= limit)
}

/**
 * The block of addresses one client controls: an IPv4 address itself, or an
 * IPv6 address's /64 network, since a home or phone is given a whole /64 and
 * can use any address in it.
 */
export function addressBlock(ip: string): string {
  const address = ip.toLowerCase().replace(/%.*$/, '')
  if (!address.includes(':')) return address
  // An IPv4 address written as IPv6 (::ffff:203.0.113.9) is that IPv4 address.
  if (address.includes('.')) return address.slice(address.lastIndexOf(':') + 1)
  const [head, tail] = address.split('::')
  const before = head ? head.split(':') : []
  const after = tail ? tail.split(':') : []
  const groups = tail === undefined ? before : [...before, ...Array<string>(Math.max(0, 8 - before.length - after.length)).fill('0'), ...after]
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`
}

/** The visitor's address as the host reports it: the first forwarded address, else the direct one. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  return (forwarded?.split(',')[0] ?? headers.get('x-real-ip') ?? '').trim()
}
