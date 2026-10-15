import type { Gauge } from './bccGauges'
import { parseQldGauges, WMIP_PORTAL } from './qldGaugesFeed'

// Queensland's statewide stream gauges, read through the /qld-gauges proxy. See qldGaugesFeed.ts.

const URL_ = import.meta.env.VITE_QLD_GAUGES_URL ?? '/qld-gauges'

export { WMIP_PORTAL }

/** The portal's own page for a station. */
export function qldGaugeUrl(id: string) {
  return `${WMIP_PORTAL}?ppbm=${encodeURIComponent(id)}&rs&cs=rs`
}

let stations: Promise<unknown> | null = null

export async function fetchQldGauges(signal?: AbortSignal): Promise<Gauge[]> {
  stations ??= fetch('/qld-gauges.json').then((r) => {
    if (!r.ok) throw new Error(`Station list responded with ${r.status}`)
    return r.json()
  })
  const [list, latest] = await Promise.all([
    stations.catch((e) => {
      stations = null
      throw e
    }),
    fetch(URL_, { signal, cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`Water monitoring portal responded with ${r.status}`)
      if ((r.headers.get('content-type') ?? '').includes('text/html')) throw new Error('Water monitoring proxy is not configured')
      return r.json()
    }),
  ])
  return parseQldGauges(list, latest, Date.now())
}
