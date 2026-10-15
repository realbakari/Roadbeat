import stationFile from '../public/qld-gauges.json' with { type: 'json' }
import { latestHeightsRequest, WMIP_SERVICE } from '../src/api/qldGaugesFeed.js'
import { json, preflight, upstream } from './_lib/http.js'

// GET /qld-gauges (rewritten here by vercel.json): the latest telemetered stream
// height at each open Queensland gauging station, from the Water Monitoring
// Information Portal's web service. The portal sends no CORS headers and takes
// about 20 seconds to answer for the whole network, so the answer is cached at the
// edge for 5 minutes (vercel.json gives this function 60 seconds).

const SITES = stationFile.stations.map(([id]) => String(id))
const TTL_MS = 5 * 60_000

let last: { at: number; body: Promise<unknown> } | null = null

function latest(): Promise<unknown> {
  if (last && Date.now() - last.at < TTL_MS) return last.body
  const body = fetch(WMIP_SERVICE, { method: 'POST', body: latestHeightsRequest(SITES), signal: AbortSignal.timeout(55_000) }).then(async (r) => {
    if (!r.ok) throw new Error(`water-monitoring.information.qld.gov.au responded with ${r.status}`)
    return r.json()
  })
  last = { at: Date.now(), body }
  body.catch(() => (last = null))
  return body
}

export function GET() {
  return upstream(async () => json(await latest(), 200, 300))
}

export const OPTIONS = preflight
