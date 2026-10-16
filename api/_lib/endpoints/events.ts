import { z } from 'zod'
import { roadEvents } from '../feeds.js'
import { Bool, json, Limit, preflight, query, upstream } from '../http.js'
import { searchRoadEvents } from '../tools.js'

const Query = z.object({
  q: z.string().max(200).optional(),
  district: z.string().max(100).optional(),
  type: z.enum(['Crash', 'Hazard', 'Flooding', 'Congestion', 'Roadworks', 'Special event']).optional(),
  closures: Bool.optional(),
  upcoming: Bool.optional(),
  limit: Limit.optional(),
})

/** GET /api/events: QLDTraffic road events. See public/openapi.json. */
export function GET(request: Request) {
  const q = query(request, Query)
  if (q instanceof Response) return q
  return upstream(async () => {
    const { events, fetchedAt } = await roadEvents()
    return json(searchRoadEvents(events, { query: q.q, district: q.district, type: q.type, closuresOnly: q.closures, includeUpcoming: q.upcoming, limit: q.limit }, fetchedAt), 200, 60)
  })
}

export const OPTIONS = preflight
