import type { CouncilCamera } from '../api/newsTypes'
import type { Camera } from '../api/types'
import { distanceKm } from './geo'

/** Image URL that changes once a minute, so live stills refresh with the clock. */
export function cameraSrc(camera: Camera, now: number) {
  const url = camera.properties.image_url
  return `${url}${url.includes('?') ? '&' : '?'}t=${Math.floor(now / 60_000)}`
}

/** "Archerfield - Ipswich Motorway & Granard Rd - North" → "Ipswich Motorway & Granard Rd - North" */
export function shortName(desc: string): string {
  const parts = desc.split(' - ')
  return parts.length > 1 ? parts.slice(1).join(' - ') : desc
}

/** Two cameras this close, of the same kind, are the same camera listed twice. */
const SAME_CAMERA_KM = 0.03

/**
 * Council cameras as Roadbeat's Camera type, beside QLDTraffic's. A council
 * camera within 30 m of a QLDTraffic camera of the same kind is left out, as
 * QLDTraffic republishes some council cameras under its own address.
 */
export function asCameras(list: CouncilCamera[], qldtraffic: Camera[]): Camera[] {
  return list
    .filter((c) => !qldtraffic.some((q) => q.kind === c.kind && distanceKm(q.geometry.coordinates as [number, number], c.position) < SAME_CAMERA_KM))
    .map((c) => ({
      type: 'Feature',
      kind: c.kind,
      council: c.council,
      geometry: { type: 'Point', coordinates: c.position },
      properties: {
        id: c.id,
        url: c.dashboard,
        description: c.description,
        direction: c.direction,
        district: c.council,
        locality: c.locality,
        postcode: null,
        image_url: c.image,
        image_sourced_from: c.council,
      },
    }))
}
