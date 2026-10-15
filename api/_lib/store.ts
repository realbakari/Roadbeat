import { createHash } from 'node:crypto'

// Push subscriptions, kept in Upstash Redis through its REST API. Vercel's
// Upstash integration sets KV_REST_API_URL and KV_REST_API_TOKEN; without them
// push alerts are off and the app hides the switch.

const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
const KEY = 'push:subs'

export const storeConfigured = !!URL_ && !!TOKEN

async function redis<T>(command: (string | number)[]): Promise<T> {
  const res = await fetch(URL_!, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10_000),
  })
  const body = (await res.json()) as { result?: T; error?: string }
  if (!res.ok || body.error) throw new Error(`Subscription store: ${body.error ?? res.status}`)
  return body.result as T
}

/** A stable id for a subscription, so the endpoint URL isn't the key. */
export const subscriptionId = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex').slice(0, 32)

export const countSubscriptions = () => redis<number>(['HLEN', KEY])

export async function saveSubscription(id: string, value: unknown) {
  await redis(['HSET', KEY, id, JSON.stringify(value)])
}

export async function deleteSubscription(id: string) {
  await redis(['HDEL', KEY, id])
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
