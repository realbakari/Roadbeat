// Cloudflare Pages Function: proxies /qld-warnings to Queensland's Severe
// Weather, Flood and Cyclone warnings feed (disaster.qld.gov.au, CC BY 4.0),
// which sends no CORS headers, and caches it at the edge for a minute.

const UPSTREAM = 'https://publiccontent-qld-alerts.s3.ap-southeast-2.amazonaws.com/content/Feeds/StormFloodCycloneWarnings/StormWarnings.json'

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
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
  })
  if (upstream.ok) waitUntil(cache.put(key, res.clone()))
  return res
}
