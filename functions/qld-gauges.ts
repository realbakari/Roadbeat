// Cloudflare Pages Function: proxies /qld-gauges to the Queensland Water Monitoring
// Information Portal's web service (CC BY 4.0), which sends no CORS headers and
// answers only a POST for the whole network, and caches the latest stream heights
// at the edge for 5 minutes.
import stationFile from '../public/qld-gauges.json'
import { latestHeightsRequest, WMIP_SERVICE } from '../src/api/qldGaugesFeed'

const SITES = stationFile.stations.map(([id]) => String(id))

interface Context {
  request: Request
  waitUntil: (p: Promise<unknown>) => void
}

export async function onRequestGet({ request, waitUntil }: Context): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default
  const key = new Request(new URL(request.url).toString())
  const hit = await cache.match(key)
  if (hit) return hit

  const upstream = await fetch(WMIP_SERVICE, { method: 'POST', body: latestHeightsRequest(SITES) })
  const res = new Response(upstream.body, {
    status: upstream.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
  })
  if (upstream.ok) waitUntil(cache.put(key, res.clone()))
  return res
}
