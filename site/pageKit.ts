// Shared pieces of the directory pages: the page shape the plugin renders,
// the breadcrumbs and paths, and small text helpers. The page builders are
// stationPage.ts, linePage.ts, placePage.ts and directoryIndexes.ts.
import type { Line, Place, Station } from './directory.ts'

export interface Crumb {
  name: string
  path: string
}

/** A static page the plugin renders: the trust pages and every directory page share this shape. */
export interface StaticPage {
  path: string
  title: string
  description: string
  markdown: string
  crumbs: Crumb[]
  /** The app view this page opens: a hash and a button label. */
  open?: { hash: string; label: string }
  /** Extra JSON-LD objects for the page (the breadcrumb list is added by the plugin). */
  jsonLd?: Record<string, unknown>[]
  noindex?: boolean
}

export const HOME: Crumb = { name: 'Roadbeat', path: '/' }
export const STATIONS: Crumb = { name: 'Stations', path: '/stations/' }
export const LINES: Crumb = { name: 'Lines and routes', path: '/lines/' }
export const PLACES: Crumb = { name: 'Places', path: '/places/' }

export const stationPath = (s: Station | string) => `/stations/${typeof s === 'string' ? s : s.slug}/`
export const linePath = (l: Line | string) => `/lines/${typeof l === 'string' ? l : l.slug}/`
export const placePath = (p: Place | string) => `/places/${typeof p === 'string' ? p : p.slug}/`

export const km = (n: number) => `${n < 0.95 ? Math.round(n * 10) / 10 : Math.round(n)} km`
export const coords = (p: [number, number]) => `${p[1]}, ${p[0]}`
export const join = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)
export const capital = (s: string) => s[0].toUpperCase() + s.slice(1)

/** A line's rider-facing title: "T1 Caboolture", "F1 Northshore Hamilton / UQ St Lucia", "Route 200 Ferry Terminal - City". */
export function lineTitle(l: Line) {
  if (l.mode === 'train') return l.name
  const prefix = /^[A-Z]/.test(l.name) ? l.name : `Route ${l.name}`
  return l.long ? `${prefix} ${l.long}` : prefix
}

export const LIVE_NOTE = 'Live departures, TransLink real-time times and the full published timetable for any day are in the Roadbeat app, not on this page.'
