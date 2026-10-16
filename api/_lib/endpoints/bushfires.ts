import { z } from 'zod'
import { bushfires } from '../feeds.js'
import { json, Limit, preflight, query, upstream } from '../http.js'
import { searchBushfires } from '../tools.js'

const Query = z.object({
  level: z.enum(['Emergency Warning', 'Watch and Act', 'Advice', 'Information']).optional(),
  q: z.string().max(100).optional(),
  limit: Limit.optional(),
})

/** GET /api/bushfires: Queensland Fire Department warnings and incidents. See public/openapi.json. */
export function GET(request: Request) {
  const q = query(request, Query)
  if (q instanceof Response) return q
  return upstream(async () => {
    const { fires, fetchedAt } = await bushfires()
    return json(searchBushfires(fires, { level: q.level, query: q.q, limit: q.limit }, fetchedAt), 200, 120)
  })
}

export const OPTIONS = preflight
