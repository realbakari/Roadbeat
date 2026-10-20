import { z } from 'zod'
import { cardSharePage } from '../../../src/lib/shareCard.js'
import { eventSharePage } from '../../../src/lib/sharePage.js'
import { roadEvents } from '../feeds.js'
import { query } from '../http.js'
import { CARD_SOURCES, findCard } from '../shareCards.js'

const Query = z.union([
  z.object({ event: z.coerce.number().int().positive() }),
  z.object({ source: z.enum(CARD_SOURCES), id: z.string().min(1).max(200) }),
])

const PAGE_HEADERS = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, s-maxage=300, stale-while-revalidate=300' }

/**
 * GET /api/share?event=<id>: a page whose link-preview tags describe one road
 * event, which redirects to it in the app. See src/lib/sharePage.ts.
 * GET /api/share?source=<source>&id=<id>: the same for a timeline post, with
 * its card image; vercel.json sends link-preview crawlers here from
 * /timeline/<source>/<id>. See src/lib/shareCard.ts.
 */
export async function GET(request: Request) {
  const q = query(request, Query)
  if (q instanceof Response) return q
  const origin = new URL(request.url).origin
  if ('source' in q) {
    const path = `/timeline/${q.source}/${encodeURIComponent(q.id)}`
    try {
      const card = await findCard(q.source, q.id)
      const image = `${origin}/api/share-image?source=${q.source}&id=${encodeURIComponent(q.id)}`
      return new Response(cardSharePage(origin, card, image), { headers: PAGE_HEADERS })
    } catch {
      // The source didn't answer: send people straight on rather than claim the post has gone.
      return Response.redirect(`${origin}${path}`, 302)
    }
  }
  try {
    const { events } = await roadEvents()
    const event = events.find((e) => e.properties.id === q.event) ?? null
    return new Response(eventSharePage(origin, q.event, event), { headers: PAGE_HEADERS })
  } catch {
    // QLDTraffic didn't answer: send people straight on rather than claim the event has gone.
    return Response.redirect(`${origin}/#event/${q.event}`, 302)
  }
}
