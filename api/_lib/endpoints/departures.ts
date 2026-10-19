import { z } from 'zod'
import { routeInfo, stops, transitRealtime, trips } from '../feeds.js'
import { json, Limit, preflight, query, Region, upstream } from '../http.js'
import { nextDepartures, resolveStop } from '../tools.js'

const Query = z.object({ stop: z.string().min(1).max(100), region: Region.optional(), route: z.string().max(40).optional(), limit: Limit.optional() })

/** GET /api/departures: next departures from a stop or station. See public/openapi.json. */
export function GET(request: Request) {
  const q = query(request, Query)
  if (q instanceof Response) return q
  const stop = resolveStop(stops, q.stop, q.region)
  if (!stop) return json({ error: `No Translink stop matches "${q.stop}". Search with /api/stops?q=…` }, 404)
  return upstream(async () => json(nextDepartures(stop, stops, trips, await transitRealtime(stop.region), routeInfo, { route: q.route, limit: q.limit, now: Date.now() }), 200, 20))
}

export const OPTIONS = preflight
