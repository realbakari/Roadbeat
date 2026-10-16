// NASA's daily true-colour satellite image, from the Global Imagery Browse
// Services (GIBS), part of NASA's Earth Science Data and Information System.
// NOAA-20's VIIRS sensor images Queensland in the early afternoon each day; the
// tiles answer CORS requests and need no key. NASA's imagery has no copyright
// restrictions; it asks to be credited.

export const GIBS_LAYER = 'VIIRS_NOAA20_CorrectedReflectance_TrueColor'
export const GIBS_CREDIT = 'Imagery: NASA GIBS, NOAA-20 VIIRS'
export const GIBS_ABOUT = 'https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api'
/** GIBS serves this layer down to zoom level 9 (about 250 m a pixel). */
export const GIBS_MAX_ZOOM = 9

/** The tile address template for one day's image, for a MapLibre raster source. */
export function gibsTiles(date: string): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_LAYER}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
}

/** A zoom 7 tile over Brisbane: GIBS answers 404 for it until that day's image there is published. */
const PROBE = { z: 7, y: 73, x: 118 }

/** yyyy-mm-dd for the day `daysBack` before `today` (yyyy-mm-dd). */
export function dayBefore(today: string, daysBack: number): string {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - daysBack)
  return d.toISOString().slice(0, 10)
}

/**
 * The newest day whose image NASA has published over Brisbane, checking
 * `today` (Queensland's date) and then up to three days before it. Null when
 * none of them answers, so the app says so instead of showing an old day as new.
 */
export async function latestImageryDate(today: string, signal?: AbortSignal): Promise<string | null> {
  for (let back = 0; back <= 3; back++) {
    const date = dayBefore(today, back)
    const url = gibsTiles(date).replace('{z}', String(PROBE.z)).replace('{y}', String(PROBE.y)).replace('{x}', String(PROBE.x))
    const res = await fetch(url, { signal })
    if (res.ok) return date
    if (res.status !== 404) throw new Error(`NASA GIBS responded with ${res.status}`)
  }
  return null
}
