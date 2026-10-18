// Cloudflare Pages Function: proxies /qld-gauges to the Queensland Water Monitoring
// Information Portal's web service (CC BY 4.0), which sends no CORS headers and
// answers only a POST for the whole network, and caches the latest stream heights
// at the edge for 5 minutes.
import stationFile from '../public/qld-gauges.json'
import { latestHeightsRequest, WMIP_SERVICE } from '../src/api/qldGaugesFeed'
import { proxy, type ProxyContext } from './_lib/proxy'

const SITES = stationFile.stations.map(([id]) => String(id))

export const onRequestGet = (context: ProxyContext) =>
  proxy(context, {
    url: WMIP_SERVICE,
    init: { method: 'POST', body: latestHeightsRequest(SITES) },
    contentType: 'application/json',
    maxAge: 300,
  })
