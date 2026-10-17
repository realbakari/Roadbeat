// Cloudflare Pages Function: proxies /qfd-firebans to the Queensland Fire
// Department's fire ban feed, which sends no CORS headers, and caches it at the
// edge for a minute. (On Vercel, a rewrite in vercel.json does the same.)

const UPSTREAM = 'https://publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com/content/Feeds/QLDFireban/FIREBAN.xml'

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
    headers: { 'content-type': 'application/atom+xml; charset=utf-8', 'cache-control': 'public, max-age=60' },
  })
  if (upstream.ok) waitUntil(cache.put(key, res.clone()))
  return res
}
