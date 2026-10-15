import type { TransitRegion } from '../api/translink'

/** A journey search carried in the URL (#transit/plan/…), so it can be shared or saved. */
export interface PlanQuery {
  region: TransitRegion
  from: string
  to: string
  date: string | null
  minutes: number | null
  arrive: boolean
}

export type TransitView =
  | { kind: 'home'; plan?: PlanQuery }
  | { kind: 'line'; mode: string; name: string }
  | { kind: 'alert'; id: string }
  | { kind: 'stop'; region: TransitRegion; id: string }

/** What the URL hash selects. At most one of these is set at a time. */
export interface Selection {
  vehicle: string | null
  transit: TransitView | null
  event: number | null
  camera: string | null
  place: { kind: string; id: string } | null
  fire: string | null
  gauge: string | null
  signal: string | null
}

/**
 * Selection lives in the URL hash so links can be shared:
 * #event/123, #camera/webcam-5, #place/rest/long007, #place/truck/1,
 * #vehicle/SEQ-…, #transit, #transit/line/train/T1%20Caboolture, #transit/alert/SEQ-500656,
 * #fire/WARN-1, #gauge/E1594, #signal/546, #transit/stop/SEQ/place_albsta, #transit/plan/SEQ/place_censta/place_cabstn[/2026-10-16/480/arrive]
 */
export function parseHash(hash: string): Selection {
  const parts = hash.replace(/^#\/?/, '').split('/')
  const transit: TransitView | null =
    parts[0] !== 'transit'
      ? null
      : parts[1] === 'line' && parts[2] && parts[3]
        ? { kind: 'line', mode: parts[2], name: decodeURIComponent(parts.slice(3).join('/')) }
        : parts[1] === 'alert' && parts[2]
          ? { kind: 'alert', id: decodeURIComponent(parts[2]) }
          : parts[1] === 'stop' && (parts[2] === 'SEQ' || parts[2] === 'CNS') && parts[3]
            ? { kind: 'stop', region: parts[2], id: decodeURIComponent(parts[3]) }
            : parts[1] === 'plan' && (parts[2] === 'SEQ' || parts[2] === 'CNS') && parts[3] && parts[4]
              ? {
                  kind: 'home',
                  plan: {
                    region: parts[2],
                    from: decodeURIComponent(parts[3]),
                    to: decodeURIComponent(parts[4]),
                    date: /^\d{4}-\d{2}-\d{2}$/.test(parts[5] ?? '') ? parts[5] : null,
                    minutes: /^\d+$/.test(parts[6] ?? '') ? Number(parts[6]) : null,
                    arrive: parts[7] === 'arrive',
                  },
                }
              : { kind: 'home' }
  return {
    vehicle: parts[0] === 'vehicle' && parts[1] ? decodeURIComponent(parts.slice(1).join('/')) : null,
    transit,
    event: parts[0] === 'event' && /^\d+$/.test(parts[1] ?? '') ? Number(parts[1]) : null,
    camera: parts[0] === 'camera' && parts[1] ? parts[1] : null,
    place: parts[0] === 'place' && parts[1] && parts[2] ? { kind: parts[1], id: decodeURIComponent(parts.slice(2).join('/')) } : null,
    fire: parts[0] === 'fire' && parts[1] ? decodeURIComponent(parts.slice(1).join('/')) : null,
    gauge: parts[0] === 'gauge' && parts[1] ? decodeURIComponent(parts[1]) : null,
    signal: parts[0] === 'signal' && parts[1] ? decodeURIComponent(parts[1]) : null,
  }
}

/** Screens that live at their own path rather than in the hash. */
export type Screen = { kind: 'app' } | { kind: 'dashboard' } | { kind: 'kiosk'; region: TransitRegion; stopId: string }

/** Which screen a path opens: /dashboard, /kiosk/SEQ/place_censta, or the app. */
export function parsePath(path: string): Screen {
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'dashboard' && parts.length === 1) return { kind: 'dashboard' }
  if (parts[0] === 'kiosk' && (parts[1] === 'SEQ' || parts[1] === 'CNS') && parts[2]) {
    return { kind: 'kiosk', region: parts[1], stopId: decodeURIComponent(parts[2]) }
  }
  return { kind: 'app' }
}

/** The kiosk path for a stop: /kiosk/SEQ/place_censta. */
export function kioskPath(region: TransitRegion, stopId: string) {
  return `/kiosk/${region}/${encodeURIComponent(stopId)}`
}
