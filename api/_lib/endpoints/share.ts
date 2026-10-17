import { z } from 'zod'
import { eventSharePage } from '../../../src/lib/sharePage.js'
import { roadEvents } from '../feeds.js'
import { query } from '../http.js'

const Query = z.object({ event: z.coerce.number().int().positive() })

/**
 * GET /api/share?event=<id>: a page whose link-preview tags describe one road
 * event, which redirects to it in the app. See src/lib/sharePage.ts.
 */
export async function GET(request: Request) {
  const q = query(request, Query)
  if (q instanceof Response) return q
  const origin = new URL(request.url).origin
  try {
    const { events } = await roadEvents()
    const event = events.find((e) => e.properties.id === q.event) ?? null
    return new Response(eventSharePage(origin, q.event, event), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, s-maxage=300, stale-while-revalidate=300' },
    })
  } catch {
    // QLDTraffic didn't answer: send people straight on rather than claim the event has gone.
    return Response.redirect(`${origin}/#event/${q.event}`, 302)
  }
}
