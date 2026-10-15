// Cloudflare Pages Function: proxies /translink-rt/<region>/<feed> to TransLink's
// GTFS-RT API (which sends no CORS headers) and caches each feed at the edge for
// a few seconds so many viewers share one upstream request.

const UPSTREAM = 'https://gtfsrt.api.translink.com.au/api/realtime'
const ALLOWED = /^(SEQ|CNS)\/(VehiclePositions|TripUpdates|alerts)$/

interface Context {
  params: { path?: string[] }
  request: Request
  waitUntil: (p: Promise<unknown>) => void
}

export async function onRequestGet({ params, request, waitUntil }: Context): Promise<Response> {
  const path = (params.path ?? []).join('/')
  if (!ALLOWED.test(path)) return new Response('Not found', { status: 404 })

  const cache = (caches as unknown as { default: Cache }).default
  const key = new Request(new URL(request.url).toString())
  const hit = await cache.match(key)
  if (hit) return hit

  const upstream = await fetch(`${UPSTREAM}/${path}`)
  const res = new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/x-protobuf',
      'cache-control': `public, max-age=${path.endsWith('alerts') ? 60 : 10}`,
    },
  })
  if (upstream.ok) waitUntil(cache.put(key, res.clone()))
  return res
}
