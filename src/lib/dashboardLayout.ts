// Which panels the dashboard shows, in what order. The choice lives in the
// page link (?show=a,b,c), so a TV or second screen can be set up by URL, and
// otherwise in this browser's storage; with neither, the default layout.

export type PanelKind = 'stat' | 'strip' | 'tile'

export interface PanelMeta {
  id: PanelId
  title: string
  kind: PanelKind
  /** The source, for the customise list. */
  source: string
}

export const PANELS = [
  { id: 'events', title: 'Road events happening now', kind: 'stat', source: 'QLDTraffic' },
  { id: 'closures', title: 'Road closures', kind: 'stat', source: 'QLDTraffic' },
  { id: 'crashes', title: 'Crashes', kind: 'stat', source: 'QLDTraffic' },
  { id: 'fire-count', title: 'Bushfire Emergency or Watch and Act', kind: 'stat', source: 'Queensland Fire Department' },
  { id: 'trains', title: 'Tracked trains on time', kind: 'stat', source: 'TransLink real-time' },
  { id: 'parking', title: 'Free in council CBD car parks', kind: 'stat', source: 'Brisbane City Council' },
  { id: 'air-count', title: 'Air quality stations Fair or worse', kind: 'stat', source: 'Department of Environment, Tourism, Science and Innovation' },
  { id: 'news', title: "What's happening", kind: 'strip', source: 'News outlets and official sources' },
  { id: 'districts', title: 'Closures and crashes by district', kind: 'tile', source: 'QLDTraffic' },
  { id: 'transit', title: 'Public transport running', kind: 'tile', source: 'TransLink real-time' },
  { id: 'fires', title: 'Bushfire warnings', kind: 'tile', source: 'Queensland Fire Department' },
  { id: 'gauges', title: 'Brisbane creeks rising fastest', kind: 'tile', source: 'Brisbane City Council gauges' },
  { id: 'signals', title: 'Busiest intersections', kind: 'tile', source: 'Brisbane City Council signals' },
  { id: 'corridors', title: 'Key corridor travel times', kind: 'tile', source: 'Brisbane City Council' },
  { id: 'council-events', title: 'Council events today', kind: 'tile', source: 'Brisbane City Council' },
  { id: 'foot-traffic', title: 'CBD foot traffic yesterday', kind: 'tile', source: 'Brisbane City Council' },
  { id: 'outages', title: 'Outages and council notices', kind: 'tile', source: 'Council disaster dashboards' },
  { id: 'centres', title: 'Council centres open', kind: 'tile', source: 'Council disaster dashboards' },
  { id: 'air', title: 'Air quality', kind: 'tile', source: 'Department of Environment, Tourism, Science and Innovation' },
  { id: 'ticker', title: 'Latest road events ticker', kind: 'strip', source: 'QLDTraffic' },
  { id: 'timeline', title: 'Replay the last 48 hours', kind: 'strip', source: 'QLDTraffic reads and the news monitor' },
] as const satisfies readonly { id: string; title: string; kind: PanelKind; source: string }[]

export type PanelId = (typeof PANELS)[number]['id']

/** The dashboard as it was before it could be customised. */
export const DEFAULT_LAYOUT: PanelId[] = [
  'events',
  'closures',
  'crashes',
  'fire-count',
  'trains',
  'parking',
  'news',
  'districts',
  'transit',
  'fires',
  'gauges',
  'signals',
  'corridors',
  'council-events',
  'foot-traffic',
  'ticker',
]

export const LAYOUT_KEY = 'qldt-dashboard'
const QUERY = 'show'

const isPanelId = (s: string): s is PanelId => PANELS.some((p) => p.id === s)

/** The layout a page link names (?show=events,news,fires), or null when it names none. Unknown ids are dropped; an empty list is a layout too. */
export function parseLayout(search: string): PanelId[] | null {
  const raw = new URLSearchParams(search).get(QUERY)
  if (raw == null) return null
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(isPanelId))]
}

/** The query string that names a layout, or '' for the default, so the default dashboard keeps its plain address. */
export function layoutQuery(layout: PanelId[]): string {
  return layout.join(',') === DEFAULT_LAYOUT.join(',') ? '' : `?${QUERY}=${layout.join(',')}`
}

/** The stored layout, or null when there is none or it no longer parses. */
export function storedLayout(storage: Pick<Storage, 'getItem'>): PanelId[] | null {
  try {
    const raw = storage.getItem(LAYOUT_KEY)
    const list: unknown = raw ? JSON.parse(raw) : null
    return Array.isArray(list) ? [...new Set(list.filter((s): s is PanelId => typeof s === 'string' && isPanelId(s)))] : null
  } catch {
    return null
  }
}

/** The layout to show: the link's, else this browser's, else the default. */
export function initialLayout(search: string, storage: Pick<Storage, 'getItem'>): PanelId[] {
  return parseLayout(search) ?? storedLayout(storage) ?? DEFAULT_LAYOUT
}

export function togglePanel(layout: PanelId[], id: PanelId): PanelId[] {
  if (layout.includes(id)) return layout.filter((p) => p !== id)
  // A newly shown panel takes its place in the registry's order among the panels already shown.
  const order = PANELS.map((p) => p.id)
  return [...layout, id].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

/** Moves a panel one place earlier (-1) or later (1) among the shown panels of its kind. */
export function movePanel(layout: PanelId[], id: PanelId, by: -1 | 1): PanelId[] {
  const kind = PANELS.find((p) => p.id === id)?.kind
  const peers = layout.filter((p) => PANELS.find((m) => m.id === p)?.kind === kind)
  const i = peers.indexOf(id)
  const j = i + by
  if (i < 0 || j < 0 || j >= peers.length) return layout
  const swapped = [...peers]
  ;[swapped[i], swapped[j]] = [swapped[j], swapped[i]]
  let n = 0
  return layout.map((p) => (peers.includes(p) ? swapped[n++] : p))
}

/** The shown panels of one kind, in order. */
export function panelsOf(layout: PanelId[], kind: PanelKind): PanelId[] {
  return layout.filter((p) => PANELS.find((m) => m.id === p)?.kind === kind)
}
