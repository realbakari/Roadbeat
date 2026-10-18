import type { CouncilNotice, PowerOutage } from '../api/councilDashboard.js'
import type { Outage } from '../api/newsTypes.js'
import { itemId, type CouncilDashboard } from './newsItems.js'
import type { GazetteerRow, PlaceIndex } from './newsPlaces.js'
import { brisbaneDayClock as clock } from './aest.js'

type LngLat = NonNullable<Outage['place']>['position']

/** "CHUWAR" as Energex writes it → "Chuwar" as the gazetteer does. */
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())

/**
 * The gazetteer row for a suburb in the council area Energex names, ignoring
 * case. The gazetteer names a suburb whose name recurs elsewhere with its
 * council, "Red Hill (Brisbane City)", so that form is tried first.
 */
function findSuburb(index: PlaceIndex, suburb: string, council: string | null): GazetteerRow | null {
  const name = suburb.toLowerCase()
  const qualified = council ? index.byLowerName.get(`${name} (${council.toLowerCase()})`) : undefined
  if (qualified) return qualified
  const row = index.byLowerName.get(name)
  return row && (!council || row[3] === council) ? row : null
}

/** "Red Hill (Brisbane City)" → "Red Hill". */
const plainName = (name: string) => name.replace(/ \([^)]*\)$/, '')

/**
 * An Energex outage placed by its suburb's gazetteer point, under the council
 * area Energex names. Energex's council names ("Ipswich City") are the
 * gazetteer's. When the suburb isn't found the outage is still kept, with no
 * place, rather than placed by a guess: it is listed as not on the map.
 */
export function fromPowerOutage(o: PowerOutage, index: PlaceIndex, dashboard: string): Outage {
  const row = findSuburb(index, o.suburb, o.council)
  const suburb = row ? plainName(row[0]) : titleCase(o.suburb)
  return {
    id: itemId(`energex|${o.event}`),
    source: 'energex',
    council: o.council ?? row?.[3] ?? 'Energex',
    area: row?.[3] ?? o.council,
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
    place: row ? { name: row[0], lga: row[3], position: [row[1], row[2]], via: 'gazetteer' } : null,
    dashboard,
  }
}

/** An Energex outage whose suburb the gazetteer doesn't list: it is kept, but has no point on the map. */
export const isUnplaced = (o: Outage) => o.place == null && o.geometry == null

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
  const facts: string[] = isUnplaced(o) ? ['Not on the map: suburb not found'] : []
  if (o.status) facts.push(o.customers != null ? `${o.status} · ${o.customers.toLocaleString('en-AU')} customers` : o.status)
  if (o.end) facts.push(`${o.source === 'energex' ? 'Estimated restore' : 'Until'} ${clock.format(o.end)}`)
  else if (o.place) facts.push(`Located from: ${o.place.name}`)
  return facts
}

