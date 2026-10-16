import { isTransitRegion, type TransitRegion } from '../api/transitTypes'

/** A journey search carried in the URL (#transit/plan/…), so it can be shared or saved. */
export interface PlanQuery {
  region: TransitRegion
  from: string
  to: string
  date: string | null
  minutes: number | null
  arrive: boolean
  /** Modes the planner may use, or null for every mode. */
  modes: string[] | null
  /** Only direct services. */
  direct: boolean
}

/**
 * The hash for a planner search: #transit/plan/SEQ/from/to/date/minutes/leave/modes.
 * "now" stands for a date or time not chosen; the last part lists the modes, plus
 * "direct" for direct services only, and is left out for every mode with changes.
 */
export function planHash(q: PlanQuery) {
  const filter = [...(q.modes ?? []), ...(q.direct ? ['direct'] : [])].join(',')
  return [
    'transit/plan',
    q.region,
    encodeURIComponent(q.from),
    encodeURIComponent(q.to),
    q.date ?? 'now',
    q.minutes ?? 'now',
    q.arrive ? 'arrive' : 'leave',
    ...(filter ? [filter] : []),
  ].join('/')
}

export type TransitView =
  | { kind: 'home'; plan?: PlanQuery }
  | { kind: 'line'; mode: string; name: string }
  | { kind: 'alert'; id: string }
  | { kind: 'stop'; region: TransitRegion; id: string }
  /** One GTFS route's page, for regions TransLink's network status doesn't list lines for. */
  | { kind: 'route'; region: TransitRegion; code: string }
  /** One trip's stops; `route` names its timetable file and `date` its service day, when known. */
  | { kind: 'trip'; region: TransitRegion; tripId: string; route: string | null; date: string | null }

/** What the URL hash selects. At most one of these is set at a time. */
export interface Selection {
  vehicle: string | null
  transit: TransitView | null
  event: number | null
  camera: string | null
  place: { kind: string; id: string } | null
  /** A gazetteer locality's page (#place/locality/Goodna), by the locality's name. */
  locality: string | null
  fire: string | null
  gauge: string | null
  signal: string | null
  /** A news monitor story id (#news/<id>), or '' for the News tab itself (#news). */
  news: string | null
}

/**
 * Selection lives in the URL hash so links can be shared:
 * #event/123, #camera/webcam-5, #place/rest/long007, #place/truck/1, #place/locality/Goodna,
 * #vehicle/SEQ-…, #transit, #transit/line/train/T1%20Caboolture, #transit/alert/SEQ-500656,
 * #fire/WARN-1, #gauge/E1594, #signal/546, #news, #news/k3j9x2, #transit/stop/SEQ/place_albsta, #transit/route/TSV/V200, #transit/trip/SEQ/<trip id>/<route>[/2026-10-16], #transit/plan/SEQ/place_censta/place_cabstn[/2026-10-16/480/arrive[/train,ferry,direct]]
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
          : parts[1] === 'route' && isTransitRegion(parts[2]) && parts[3]
            ? { kind: 'route', region: parts[2], code: decodeURIComponent(parts[3]) }
          : parts[1] === 'stop' && isTransitRegion(parts[2]) && parts[3]
            ? { kind: 'stop', region: parts[2], id: decodeURIComponent(parts[3]) }
            : parts[1] === 'trip' && isTransitRegion(parts[2]) && parts[3]
              ? {
                  kind: 'trip',
                  region: parts[2],
                  tripId: decodeURIComponent(parts[3]),
                  route: parts[4] ? decodeURIComponent(parts[4]) : null,
                  date: /^\d{4}-\d{2}-\d{2}$/.test(parts[5] ?? '') ? parts[5] : null,
                }
            : parts[1] === 'plan' && isTransitRegion(parts[2]) && parts[3] && parts[4]
              ? {
                  kind: 'home',
                  plan: {
                    region: parts[2],
                    from: decodeURIComponent(parts[3]),
                    to: decodeURIComponent(parts[4]),
                    date: /^\d{4}-\d{2}-\d{2}$/.test(parts[5] ?? '') ? parts[5] : null,
                    minutes: /^\d+$/.test(parts[6] ?? '') ? Number(parts[6]) : null,
                    arrive: parts[7] === 'arrive',
                    modes: parts[8]?.split(',').some((m) => m !== 'direct') ? parts[8].split(',').filter((m) => m !== 'direct') : null,
                    direct: !!parts[8]?.split(',').includes('direct'),
                  },
                }
              : { kind: 'home' }
  return {
    vehicle: parts[0] === 'vehicle' && parts[1] ? decodeURIComponent(parts.slice(1).join('/')) : null,
    transit,
    event: parts[0] === 'event' && /^\d+$/.test(parts[1] ?? '') ? Number(parts[1]) : null,
    camera: parts[0] === 'camera' && parts[1] ? parts[1] : null,
    place: parts[0] === 'place' && parts[1] && parts[1] !== 'locality' && parts[2] ? { kind: parts[1], id: decodeURIComponent(parts.slice(2).join('/')) } : null,
    locality: parts[0] === 'place' && parts[1] === 'locality' && parts[2] ? decodeURIComponent(parts.slice(2).join('/')) : null,
    fire: parts[0] === 'fire' && parts[1] ? decodeURIComponent(parts.slice(1).join('/')) : null,
    gauge: parts[0] === 'gauge' && parts[1] ? decodeURIComponent(parts[1]) : null,
    signal: parts[0] === 'signal' && parts[1] ? decodeURIComponent(parts[1]) : null,
    news: parts[0] === 'news' ? decodeURIComponent(parts[1] ?? '') : null,
  }
}

/** Screens that live at their own path rather than in the hash. */
export type Screen = { kind: 'app' } | { kind: 'dashboard' } | { kind: 'status' } | { kind: 'kiosk'; region: TransitRegion; stopId: string }

/** Which screen a path opens: /dashboard, /status, /kiosk/SEQ/place_censta, or the app. */
export function parsePath(path: string): Screen {
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'dashboard' && parts.length === 1) return { kind: 'dashboard' }
  if (parts[0] === 'status' && parts.length === 1) return { kind: 'status' }
  if (parts[0] === 'kiosk' && isTransitRegion(parts[1]) && parts[2]) {
    return { kind: 'kiosk', region: parts[1], stopId: decodeURIComponent(parts[2]) }
  }
  return { kind: 'app' }
}

/** The hash for a route's page: #transit/route/TSV/V200. */
export function routeHref(region: TransitRegion, code: string) {
  return `transit/route/${region}/${encodeURIComponent(code)}`
}

/** The kiosk path for a stop: /kiosk/SEQ/place_censta. */
export function kioskPath(region: TransitRegion, stopId: string) {
  return `/kiosk/${region}/${encodeURIComponent(stopId)}`
}
