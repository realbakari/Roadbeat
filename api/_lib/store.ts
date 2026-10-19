import { createHash } from 'node:crypto'
import { hasRoom } from './visits.js'

// Push subscriptions and the news monitor's items, kept in Upstash Redis through
// its REST API. Vercel's Upstash integration sets KV_REST_API_URL and
// KV_REST_API_TOKEN; without them push alerts are off and the app hides the
// switch, and the news monitor reads its feeds on each request instead.

const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
const KEY = 'push:subs'

export const storeConfigured = !!URL_ && !!TOKEN

/**
 * A stored record (the news snapshot or the event history) older than this means
 * the 5-minute scheduler (api/news-ingest.ts) has stopped, so a request reads
 * the feed itself.
 */
export const STALE_MS = 15 * 60_000

/** Runs one Redis command, such as ['GET', key]. */
export async function redis<T>(command: (string | number)[]): Promise<T> {
  const res = await fetch(URL_!, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10_000),
  })
  const body = (await res.json()) as { result?: T; error?: string }
  if (!res.ok || body.error) throw new Error(`Redis store: ${body.error ?? res.status}`)
  return body.result as T
}

/** Runs several commands in one request, in order, and returns each one's result. */
export async function redisPipeline<T>(commands: (string | number)[][]): Promise<T[]> {
  const res = await fetch(`${URL_!.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(10_000),
  })
  const body = (await res.json()) as { result?: T; error?: string }[] | { error?: string }
  if (!res.ok || !Array.isArray(body)) throw new Error(`Redis store: ${(body as { error?: string }).error ?? res.status}`)
  return body.map((b) => {
    if (b.error) throw new Error(`Redis store: ${b.error}`)
    return b.result as T
  })
}

/** A stable id for a subscription, so the endpoint URL isn't the key. */
export const subscriptionId = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex').slice(0, 32)

export const countSubscriptions = () => redis<number>(['HLEN', KEY])

/** One stored subscription as parsed JSON: null when there's none, or a value that isn't JSON when it's corrupt. */
export async function getSubscription(id: string): Promise<unknown> {
  const raw = await redis<string | null>(['HGET', KEY, id])
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export async function saveSubscription(id: string, value: unknown) {
  await redis(['HSET', KEY, id, JSON.stringify(value)])
}

/** Saves several subscriptions, 100 to a command so no request grows past Upstash's size limit. */
export async function saveSubscriptions(entries: [string, unknown][]) {
  for (let i = 0; i < entries.length; i += 100)
    await redis(['HSET', KEY, ...entries.slice(i, i + 100).flatMap(([id, value]) => [id, JSON.stringify(value)])])
}

export async function deleteSubscription(id: string) {
  await deleteSubscriptions([id])
}

/** Deletes several subscriptions in one command. */
export async function deleteSubscriptions(ids: string[]) {
  if (ids.length) await redis(['HDEL', KEY, ...ids])
}

/**
 * Counts one use of a daily allowance kept under `key` (from rateKey()) and says
 * whether it was within `limit`. It reads the count first, so a caller already
 * over the limit costs one Redis command and the count stops growing.
 */
export async function takeDaily(key: string, limit: number): Promise<boolean> {
  if (!hasRoom(await redis<unknown>(['GET', key]), limit)) return false
  const [count] = await redisPipeline<number>([
    ['INCR', key],
    ['EXPIRE', key, 86_400],
  ])
  return count <= limit
}

/** Every stored subscription as [id, parsed JSON]. */
export async function allSubscriptions(): Promise<[string, unknown][]> {
  const flat = await redis<string[]>(['HGETALL', KEY])
  const out: [string, unknown][] = []
  for (let i = 0; i + 1 < flat.length; i += 2) {
    try {
      out.push([flat[i], JSON.parse(flat[i + 1])])
    } catch {
      // A corrupt entry is skipped; the next save for that browser replaces it.
    }
  }
  return out
}
