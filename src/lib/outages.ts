import type { CouncilNotice, PowerOutage } from '../api/councilDashboard.js'
import type { Outage } from '../api/newsTypes.js'
import { itemId, type CouncilDashboard } from './newsItems.js'
import type { PlaceIndex } from './newsPlaces.js'

type LngLat = NonNullable<Outage['place']>['position']

/** "CHUWAR" as Energex writes it → "Chuwar" as the gazetteer does. */
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())

/**
 * An Energex outage placed by its suburb's gazetteer point, if the suburb is
 * in the gazetteer, under the council area Energex names. Energex's council
 * names ("Ipswich City") are the gazetteer's. Null when the suburb isn't found,
 * rather than a guess: Roadbeat has nowhere to put it.
 */
export function fromPowerOutage(o: PowerOutage, index: PlaceIndex, dashboard: string): Outage | null {
  const suburb = titleCase(o.suburb)
  const row = index.byName.get(suburb)
  if (!row || (o.council && row[3] !== o.council)) return null
  return {
    id: itemId(`energex|${o.event}`),
    source: 'energex',
    council: o.council ?? row[3],
    area: row[3],
    type: 'Power',
    title: `${o.cause ?? 'Power outage'}, ${suburb}`,
    details: null,
    status: o.status,
    customers: o.customers,
    streets: o.streets.map(titleCase),
    start: null,
    end: o.restore,
    updated: null,
    geometry: null,
    place: { name: suburb, lga: row[3], position: [row[1], row[2]], via: 'gazetteer' },
    dashboard,
  }
}

/** A council's notice, drawn at the shape the council published. */
export function fromCouncilNotice(d: CouncilDashboard, n: CouncilNotice): Outage {
  return {
    id: itemId(`${d.page}|notice|${n.id}`),
    source: 'council',
    council: d.council,
    area: d.area,
    type: n.type,
    title: n.title,
    details: n.details,
    status: n.incident,
    customers: null,
    streets: [],
    start: n.start,
    end: n.end,
    updated: n.updated,
    geometry: n.geometry,
    place: null,
    dashboard: d.page,
  }
}

/** Energex relays the same outage through every dashboard, so each event counts once. */
export function dedupeOutages(list: Outage[]): Outage[] {
  const seen = new Set<string>()
  return list.filter((o) => !seen.has(o.id) && seen.add(o.id))
}

function firstPoint(coordinates: unknown): LngLat | null {
  let c: unknown = coordinates
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0]
  return Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number' ? [c[0], c[1]] : null
}

/** Where an outage sits on the map: its gazetteer suburb, or the first point of the council's shape. */
export function outagePosition(o: Outage): LngLat | null {
  return o.place?.position ?? (o.geometry ? firstPoint(o.geometry.coordinates) : null)
}

/** Each source's map colour: Energex outages, council notices. */
export const OUTAGE_COLOR: Record<Outage['source'], string> = { energex: '#b91c1c', council: '#0e7490' }

/** Two short published facts for a card: status and customers, or planned dates. */
export function outageFacts(o: Outage): string[] {
  const facts: string[] = []
  if (o.status) facts.push(o.customers != null ? `${o.status} · ${o.customers.toLocaleString('en-AU')} customers` : o.status)
  if (o.end) facts.push(`${o.source === 'energex' ? 'Estimated restore' : 'Until'} ${clock.format(o.end)}`)
  else if (o.place) facts.push(`Located from: ${o.place.name}`)
  return facts
}

const clock = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', hour: 'numeric', minute: '2-digit' })
