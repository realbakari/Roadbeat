import { json, preflight, upstream } from '../http.js'
import { redisPipeline, storeConfigured } from '../store.js'
import { brisbaneDay, clientIp, dayKey, recentWindowKeys, visitorId, windowKey } from '../visits.js'

// /api/visits: how many people are using Roadbeat, for the count in the header.
//
// POST records the calling browser in the current day's and 5-minute window's
// HyperLogLogs under an id hashed from its address, browser and the date with a
// server-side secret (api/_lib/visits.ts). A HyperLogLog keeps an estimate of
// how many distinct ids it saw, not the ids, and the day's key expires after
// two days. GET returns the estimates, cached at the edge for a minute.
// Without the Redis store, GET says the count isn't available and POST is a
// no-op, so the app shows nothing.

const SALT = process.env.VISITS_SALT ?? process.env.CRON_SECRET ?? ''
const DAY_TTL = 2 * 86_400
const WINDOW_TTL = 15 * 60

export function GET() {
  if (!storeConfigured) return json({ available: false }, 200, 60)
  return upstream(async () => {
    const now = Date.now()
    const day = brisbaneDay(now)
    const [online, today] = await redisPipeline<number>([
      ['PFCOUNT', ...recentWindowKeys(now)],
      ['PFCOUNT', dayKey(day)],
    ])
    return json({ available: true, online, today, day, at: now }, 200, 60)
  })
}

export async function POST(request: Request) {
  if (storeConfigured) {
    const now = Date.now()
    const day = brisbaneDay(now)
    const id = visitorId(clientIp(request.headers), request.headers.get('user-agent') ?? '', day, SALT)
    const win = windowKey(now)
    try {
      await redisPipeline([
        ['PFADD', dayKey(day), id],
        ['EXPIRE', dayKey(day), DAY_TTL],
        ['PFADD', win, id],
        ['EXPIRE', win, WINDOW_TTL],
      ])
    } catch {
      // A missed ping only undercounts; the browser tries again in five minutes.
    }
  }
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
}

export const OPTIONS = preflight
