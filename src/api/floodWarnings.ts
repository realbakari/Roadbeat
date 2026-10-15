import { z } from 'zod'
import CATCHMENTS from '../data/gauge-catchments.json'

// The Bureau of Meteorology flood warning area each Brisbane City Council stream
// gauge is in (scripts/build-gauge-catchments.mjs, from BoM's National Flood Gauge
// Network, CC BY 4.0). BoM's warning text and flood levels aren't openly licensed,
// so the app links to BoM's page for the area instead of showing them.

const File = z.object({ gauges: z.record(z.string(), z.tuple([z.string(), z.string().regex(/^ID[A-Z]\d+$/)])) })
const GAUGES = File.parse(CATCHMENTS).gauges

/** BoM's current warnings for Queensland, including flood watches and warnings. */
export const BOM_QLD_WARNINGS = 'https://www.bom.gov.au/weather-and-climate/warnings-and-alerts?state=qld'

export interface FloodWarningArea {
  /** BoM's name for the flood warning catchment, e.g. "Brisbane River downstream of Wivenhoe Dam". */
  catchment: string
  /** BoM product id of the area's flood warning, e.g. "IDQ20811". */
  product: string
  /** BoM's page for that warning, which says whether one is current. */
  url: string
}

/** The BoM flood warning area for a gauge, or null when the gauge isn't in one. */
export function floodWarningArea(gaugeId: string): FloodWarningArea | null {
  const hit = GAUGES[gaugeId]
  return hit ? { catchment: hit[0], product: hit[1], url: `https://reg.bom.gov.au/cgi-bin/wrap_fwo.pl?${hit[1]}.html` } : null
}
