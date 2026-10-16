import { z } from 'zod'
import { stops } from '../feeds.js'
import { json, Limit, preflight, query, Region } from '../http.js'
import { findStops } from '../tools.js'

const Query = z.object({ q: z.string().min(1).max(100), region: Region.optional(), limit: Limit.optional() })

/** GET /api/stops: TransLink stops and stations by name. See public/openapi.json. */
export function GET(request: Request) {
  const q = query(request, Query)
  if (q instanceof Response) return q
  return json({ source: 'Translink GTFS (CC BY 4.0)', stops: findStops(stops, q.q, q.region, q.limit) }, 200, 86_400)
}

export const OPTIONS = preflight
