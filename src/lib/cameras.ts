import type { Camera } from '../api/types'

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
