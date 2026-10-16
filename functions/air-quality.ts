// Cloudflare Pages Function: proxies /air-quality to the Department of
// Environment, Tourism, Science and Innovation's live air quality feed
// (data.qld.gov.au, CC BY 4.0), which sends no CORS headers. The feed changes
// hourly, so the edge keeps it for 5 minutes.

const UPSTREAM = 'https://apps.des.qld.gov.au/air-quality/xml/feed.php?category=1&region=ALL'

interface Context {
  request: Request
  waitUntil: (p: Promise<unknown>) => void
}

export async function onRequestGet({ request, waitUntil }: Context): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default
  const key = new Request(new URL(request.url).toString())
  const hit = await cache.match(key)
  if (hit) return hit

  const upstream = await fetch(UPSTREAM)
  const res = new Response(upstream.body, {
    status: upstream.status,
    headers: { 'content-type': 'text/xml; charset=utf-8', 'cache-control': 'public, max-age=300' },
  })
  if (upstream.ok) waitUntil(cache.put(key, res.clone()))
  return res
}
