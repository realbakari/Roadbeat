import { z } from 'zod'
import { roadListHtml } from '../../../src/lib/roadList.js'
import { roadEvents } from '../feeds.js'
import { Bool, query } from '../http.js'

const Query = z.object({
  district: z.string().max(100).optional(),
  closures: Bool.optional(),
})

const HTML = { 'content-type': 'text/html; charset=utf-8' }

/** GET /api/roads (served at /roads): QLDTraffic's current road events as one plain HTML page. See src/lib/roadList.ts. */
export async function GET(request: Request) {
  const q = query(request, Query)
  if (q instanceof Response) return q
  try {
    const { events, fetchedAt } = await roadEvents()
    return new Response(roadListHtml(events, fetchedAt, Date.now(), { district: q.district, closuresOnly: q.closures }), {
      headers: { ...HTML, 'cache-control': 'public, s-maxage=60, stale-while-revalidate=60' },
    })
  } catch (e) {
    console.error('roads: QLDTraffic read failed', e)
    // A failure, said in words; the browser's saved copy (public/sw.js) takes over where it has one.
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Road events · Roadbeat</title><p>Roadbeat couldn\'t reach QLDTraffic just now, so there is no road events list to show. Try again shortly, or call Transport and Main Roads on 13 19 40.</p>', {
      status: 503,
      headers: { ...HTML, 'cache-control': 'no-store' },
    })
  }
}
