import type { LngLat } from '../lib/geo'

// Fixed speed, red light, combined and point-to-point camera sites, from the
// Queensland Government's own map of them, linked from qld.gov.au's "Locations
// of speed and red light cameras" page. Google My Maps serves the map as KML
// with Access-Control-Allow-Origin: *, so it is read live, as published. Mobile
// speed camera sites are published only as road and suburb names, with no
// position, so they are linked to rather than placed on the map.

export const SPEED_CAMERAS_URL = 'https://www.google.com/maps/d/kml?mid=1KO5byT1dvAbg-wBx8IeAEA7KC2Y&forcekml=1'
export const SPEED_CAMERAS_PAGE = 'https://www.qld.gov.au/transport/safety/fines/speed/location'
export const MOBILE_CAMERA_SITES = 'https://www.data.qld.gov.au/dataset/active-mobile-speed-camera-sites'

export type SpeedCameraType = 'fixed' | 'combined' | 'redlight' | 'p2p'

export const SPEED_CAMERA_LABEL: Record<SpeedCameraType, string> = {
  fixed: 'Fixed speed camera',
  combined: 'Combined red light and speed camera',
  redlight: 'Red light camera',
  p2p: 'Point-to-point speed camera',
}

export interface SpeedCamera {
  /** Built from the type and position, which the map has no id for. */
  id: string
  type: SpeedCameraType
  /** The published site description, e.g. "Kingston Road, Loganlea at intersection with Station Road". */
  site: string
  position: LngLat
}

/** The camera type from the placemark's published name, "Camera type: …", or null for one it doesn't name. */
function cameraType(name: string): SpeedCameraType | null {
  const n = name.toLowerCase()
  if (n.includes('point-to-point')) return 'p2p'
  if (n.includes('red light') && n.includes('speed')) return 'combined'
  if (n.includes('red light')) return 'redlight'
  if (n.includes('speed')) return 'fixed'
  return null
}

const text = (block: string, tag: string) => {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').trim() : ''
}

/** Each placemark with a type it names and a point; anything else is left out. */
export function parseSpeedCameras(kml: string): SpeedCamera[] {
  const out: SpeedCamera[] = []
  const seen = new Map<string, number>()
  for (const block of kml.match(/<Placemark>[\s\S]*?<\/Placemark>/g) ?? []) {
    const type = cameraType(text(block, 'name'))
    const [lng, lat] = text(text(block, 'Point'), 'coordinates').split(',').map(Number)
    if (!type || !Number.isFinite(lng) || !Number.isFinite(lat)) continue
    // Two sites can share a point (each direction of a road), so a repeat gets a suffix.
    const base = `${type}-${lng.toFixed(5)}-${lat.toFixed(5)}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    out.push({ id: n > 1 ? `${base}-${n}` : base, type, site: text(block, 'description'), position: [lng, lat] })
  }
  return out
}

export async function fetchSpeedCameras(signal?: AbortSignal): Promise<SpeedCamera[]> {
  const res = await fetch(SPEED_CAMERAS_URL, { signal })
  if (!res.ok) throw new Error(`The camera map responded with ${res.status}`)
  const cameras = parseSpeedCameras(await res.text())
  if (!cameras.length) throw new Error('The camera map had no camera sites in it')
  return cameras
}
