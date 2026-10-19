import type { FireWarning } from '../api/bushfires'
import type { QldWarning } from '../api/qldWarnings'
import type { TrafficEvent } from '../api/types'
import type { NewsStory } from './newsStories'
import { routeInfo, type TransitAlert } from '../api/translink'
import { clean } from './format'
import { isClosure, isUpcoming } from './filters'
import { distanceKm, eventAnchor, type LngLat } from './geo'
import { eventPlace, eventTitle } from './eventText'

export type AlertKind = 'crash' | 'closure' | 'redAlert' | 'high' | 'flooding' | 'hazard' | 'congestion' | 'roadworks' | 'bushfire' | 'warning' | 'newsOfficial' | 'news'

export const ALERT_KINDS: { key: AlertKind; label: string }[] = [
  { key: 'crash', label: 'Crashes' },
  { key: 'closure', label: 'Road closures' },
  { key: 'redAlert', label: 'Red Alerts' },
  { key: 'high', label: 'High-priority events' },
  { key: 'flooding', label: 'Flooding' },
  { key: 'hazard', label: 'Hazards' },
  { key: 'congestion', label: 'Congestion' },
  { key: 'roadworks', label: 'Roadworks starting' },
  { key: 'bushfire', label: 'Bushfire warnings' },
  { key: 'warning', label: 'Storm, flood and cyclone warnings' },
  { key: 'newsOfficial', label: 'Police, BoM and earthquake notices' },
  { key: 'news', label: 'News reports' },
]

export interface AlertSettings {
  /** Toasts and the notification centre. */
  inApp: boolean
  /** System notifications while the tab is in the background. */
  browser: boolean
  kinds: Record<AlertKind, boolean>
  /** Empty districts/roads and no nearMe means anywhere in Queensland. */
  districts: string[]
  roads: string[]
  nearMe: { at: LngLat; km: number } | null
  watchedEvents: number[]
  /** Route numbers or line names, e.g. "402", "F1", "Caboolture". */
  routes: string[]
  /**
   * The user chose alerts from anywhere in Queensland. Until they choose that
   * or an area, only watched events and routes alert, so a first visit isn't
   * a stream of statewide crashes and closures.
   */
  everywhere: boolean
}

export const DEFAULT_SETTINGS: AlertSettings = {
  inApp: true,
  browser: false,
  kinds: {
    crash: true,
    closure: true,
    redAlert: true,
    high: false,
    flooding: false,
    hazard: false,
    congestion: false,
    roadworks: false,
    bushfire: true,
    warning: true,
    newsOfficial: false,
    news: false,
  },
  districts: [],
  roads: [],
  nearMe: null,
  watchedEvents: [],
  routes: [],
  everywhere: false,
}

const KEY = 'qldt-alert-settings'

const isString = (x: unknown) => typeof x === 'string'
const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const listOf = <T>(v: unknown, ok: (x: unknown) => boolean, fallback: T[]): T[] => (Array.isArray(v) ? (v.filter(ok) as T[]) : fallback)
const flag = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

/**
 * Settings as stored by an earlier visit, read field by field: anything
 * missing or of the wrong shape (an older version, or a hand-edited value)
 * takes its default, and the rest of the rider's choices are kept.
 */
export function parseSettings(json: unknown): AlertSettings {
  const s = json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
  const kinds = s.kinds && typeof s.kinds === 'object' ? (s.kinds as Record<string, unknown>) : {}
  const near = s.nearMe && typeof s.nearMe === 'object' ? (s.nearMe as Record<string, unknown>) : null
  const at = near && Array.isArray(near.at) && near.at.length === 2 && near.at.every(isNumber) ? (near.at as LngLat) : null
  const D = DEFAULT_SETTINGS
  return {
    inApp: flag(s.inApp, D.inApp),
    browser: flag(s.browser, D.browser),
    kinds: Object.fromEntries(Object.entries(D.kinds).map(([k, on]) => [k, flag(kinds[k], on)])) as AlertSettings['kinds'],
    districts: listOf(s.districts, isString, D.districts),
    roads: listOf(s.roads, isString, D.roads),
    nearMe: at && isNumber(near?.km) && near.km > 0 ? { at, km: near.km } : null,
    watchedEvents: listOf(s.watchedEvents, isNumber, D.watchedEvents),
    routes: listOf(s.routes, isString, D.routes),
    // Settings saved before the choice existed alerted statewide, and keep doing so.
    everywhere: flag(s.everywhere, !!json && typeof json === 'object' && !Array.isArray(json)),
  }
}

export function loadSettings(): AlertSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? parseSettings(JSON.parse(raw)) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: AlertSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Storage can be unavailable (private mode); settings then last for this visit only.
  }
}

export function hasAreaFilter(s: AlertSettings) {
  return s.districts.length > 0 || s.roads.length > 0 || !!s.nearMe
}

/** Where new-item alerts come from: the user's places, anywhere in Queensland, or nowhere until they choose. */
export function alertArea(s: AlertSettings): 'places' | 'everywhere' | 'unset' {
  return hasAreaFilter(s) ? 'places' : s.everywhere ? 'everywhere' : 'unset'
}

function kindsOf(e: TrafficEvent): AlertKind[] {
  const p = e.properties
  const k: AlertKind[] = []
  if (p.event_type === 'Crash') k.push('crash')
  if (isClosure(e)) k.push('closure')
  if (p.event_priority === 'Red Alert') k.push('redAlert')
  if (p.event_priority === 'High') k.push('high')
  if (p.event_type === 'Flooding') k.push('flooding')
  if (p.event_type === 'Hazard') k.push('hazard')
  if (p.event_type === 'Congestion') k.push('congestion')
  if (p.event_type === 'Roadworks') k.push('roadworks')
  return k
}

function inArea(e: TrafficEvent, s: AlertSettings) {
  if (!hasAreaFilter(s)) return true
  const r = e.properties.road_summary
  if (s.districts.length && r?.district?.split(' / ').some((d) => s.districts.includes(d.trim()))) return true
  if (s.roads.length) {
    const hay = [r?.road_name, r?.locality, r?.postcode, e.properties.description].filter(Boolean).join(' ').toLowerCase()
    if (s.roads.some((q) => hay.includes(q.toLowerCase()))) return true
  }
  if (s.nearMe) {
    const a = eventAnchor(e)
    if (a && distanceKm(s.nearMe.at, a) <= s.nearMe.km) return true
  }
  return false
}

/** Does a newly published (current) event match the user's rules? */
export function matchesRules(e: TrafficEvent, s: AlertSettings, now = Date.now()) {
  if (isUpcoming(e, now) || alertArea(s) === 'unset') return false
  return kindsOf(e).some((k) => s.kinds[k]) && inArea(e, s)
}

/** Which of the user's watched routes an alert touches (by route code or line name). */
export function watchedRoutesIn(a: TransitAlert, routes: string[]) {
  if (!routes.length) return []
  const hits = new Set<string>()
  for (const q of routes) {
    const needle = q.trim().toLowerCase()
    if (!needle) continue
    const hit = a.routes.some((r) => {
      const info = routeInfo(r, a.region)
      return (
        r.toLowerCase() === needle ||
        info?.short.toLowerCase() === needle ||
        info?.long.toLowerCase() === needle ||
        // Train lines by name: "T1 Caboolture" or just "Caboolture".
        (info?.line?.toLowerCase().includes(needle) ?? false)
      )
    })
    if (hit) hits.add(q)
  }
  return [...hits]
}

/** Fields whose change is worth telling a watcher about. */
export function eventSignature(e: TrafficEvent) {
  const p = e.properties
  return JSON.stringify([
    p.status,
    p.event_priority,
    p.impact?.impact_type,
    p.impact?.impact_subtype,
    p.impact?.delay,
    clean(p.description),
    clean(p.advice),
    p.duration?.end,
  ])
}

export function describeChange(prev: string, e: TrafficEvent): string {
  const p = e.properties
  const [status, priority, , subtype, delay] = JSON.parse(prev) as (string | null)[]
  if (p.status === 'Reopened' && status !== 'Reopened') return 'Road reopened'
  if (p.event_priority !== priority) return `Priority now ${p.event_priority}`
  if (p.impact?.impact_subtype !== subtype) return clean(p.impact?.impact_subtype) ?? 'Impact changed'
  if (p.impact?.delay !== delay) return clean(p.impact?.delay) ?? 'Delay changed'
  return 'Details updated'
}

export function eventHeadline(e: TrafficEvent) {
  const p = e.properties
  const what = isClosure(e) ? (clean(p.impact?.impact_subtype) ?? 'Road closed') : p.event_type
  return { title: `${what} · ${eventTitle(e)}`, body: [eventPlace(e), clean(p.description)].filter(Boolean).join(' — ') }
}

/**
 * Should a Queensland Fire Department warning (Advice or higher) alert the user?
 * Area rules use distance from the fire or the user's listed roads and places in
 * its area and title. QFD doesn't use TMR districts, so a districts-only filter
 * never matches a fire rather than guessing.
 */
export function fireMatches(f: FireWarning, s: AlertSettings) {
  if (!s.kinds.bushfire || f.level === 'Information' || alertArea(s) === 'unset') return false
  if (!hasAreaFilter(s)) return true
  if (s.nearMe && distanceKm(s.nearMe.at, f.position) <= s.nearMe.km) return true
  if (s.roads.length) {
    const hay = [f.area, f.title, f.location].filter(Boolean).join(' ').toLowerCase()
    if (s.roads.some((q) => hay.includes(q.toLowerCase()))) return true
  }
  return false
}

/** Whether a point lies inside any ring of a warning's published area (even-odd rule). */
function inShape(p: LngLat, shape: GeoJSON.MultiPolygon): boolean {
  return shape.coordinates.some(([ring]) => {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  })
}

/**
 * Should a Queensland Disaster Management warning (Advice or higher) alert the
 * user? Area rules use the warning's published area or distance from its
 * marker, or the user's listed roads and places in its area, title and issuer.
 * Like bushfires, warnings aren't filed under TMR districts, so a
 * districts-only filter never matches one rather than guessing.
 */
export function warningMatches(w: QldWarning, s: AlertSettings) {
  if (!s.kinds.warning || w.level === 'Other' || alertArea(s) === 'unset') return false
  if (!hasAreaFilter(s)) return true
  if (s.nearMe && (distanceKm(s.nearMe.at, w.position) <= s.nearMe.km || (w.areaShape != null && inShape(s.nearMe.at, w.areaShape)))) return true
  if (s.roads.length) {
    const hay = [w.area, w.title, w.from].filter(Boolean).join(' ').toLowerCase()
    if (s.roads.some((q) => hay.includes(q.toLowerCase()))) return true
  }
  return false
}

/**
 * Should a new news monitor story alert the user? Official notices and news
 * reports are separate choices. Area rules use distance from a place the story
 * names, or the user's listed roads and places in its headlines and summaries.
 * Stories aren't filed under TMR districts, so a districts-only filter never
 * matches one rather than guessing.
 */
export function newsMatches(story: NewsStory, s: AlertSettings) {
  if (!s.kinds[story.kind === 'official' ? 'newsOfficial' : 'news'] || alertArea(s) === 'unset') return false
  if (!hasAreaFilter(s)) return true
  if (s.nearMe && story.places.some((p) => distanceKm(s.nearMe!.at, p.position) <= s.nearMe!.km)) return true
  if (s.roads.length) {
    const hay = story.items.flatMap((i) => [i.title, i.summary ?? '']).join(' ').toLowerCase()
    if (s.roads.some((q) => hay.includes(q.toLowerCase()))) return true
  }
  return false
}
