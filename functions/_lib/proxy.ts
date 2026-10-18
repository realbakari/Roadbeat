// The shared body of the Cloudflare Pages proxies (air-quality, qfd-bushfires,
// qfd-firebans, qld-gauges, qld-warnings): fetch one official feed that sends no
// CORS headers and keep a good answer at the edge for a while, so many viewers
// share one upstream request. Pages makes routes only from the onRequest
// handlers a module exports, so this helper is never served as a page.

/** What Pages passes a function that the proxies use. */
export interface ProxyContext {
  request: Request
  waitUntil: (p: Promise<unknown>) => void
}

interface Feed {
  /** The official feed's address. */
  url: string
  /** Sent with the request, for a feed that answers only a POST. */
  init?: RequestInit
  contentType: string
  /** How long a good answer is kept, in seconds. */
  maxAge: number
}

/** Long enough for the slowest feed (the water portal's whole network, about 20 s). */
const TIMEOUT_MS = 55_000

export async function proxy({ request, waitUntil }: ProxyContext, feed: Feed): Promise<Response> {
  const cache = caches.default
  const key = new Request(new URL(request.url).toString())
  const hit = await cache.match(key)
  if (hit) return hit

  let upstream: Response
  try {
    upstream = await fetch(feed.url, { ...feed.init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    return Response.json({ error: 'An official data source did not respond. Try again shortly.' }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
  // An error answer isn't kept anywhere, so the next request tries the feed again.
  const res = new Response(upstream.body, {
    status: upstream.status,
    headers: { 'content-type': feed.contentType, 'cache-control': upstream.ok ? `public, max-age=${feed.maxAge}` : 'no-store' },
  })
  if (upstream.ok) waitUntil(cache.put(key, res.clone()))
  return res
}
