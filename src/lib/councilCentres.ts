import type { CentreListing } from '../api/councilDashboard.js'
import type { CouncilCentre } from '../api/newsTypes.js'
import { itemId, type CouncilDashboard } from './newsItems.js'

/** A council centre as Roadbeat keeps it: the listing as published, with its council and dashboard. */
export function toCentre(d: CouncilDashboard, c: CentreListing): CouncilCentre {
  return { id: itemId(`${d.page}|${c.name}|${c.address ?? ''}`), council: d.council, area: d.area, dashboard: d.page, ...c }
}

/**
 * The centres to keep after a run: each council that answered replaces its
 * list; a council that didn't keeps its last one, so a slow dashboard doesn't
 * empty the map.
 */
export function mergeCentres(previous: CouncilCentre[], fresh: CouncilCentre[], answered: Set<string>): CouncilCentre[] {
  return [...previous.filter((c) => !answered.has(c.council)), ...fresh]
}

export type CentreKind = 'shelter' | 'sandbag' | 'other'

/** Each kind's map colour. */
export const CENTRE_COLOR: Record<CentreKind, string> = { shelter: '#0f766e', sandbag: '#b45309', other: '#475569' }

// Councils name centre types in their own words. These keywords sort them into
// map symbols only; the council's exact type is always shown beside them.
const KINDS: [CentreKind, RegExp][] = [
  ['shelter', /evacuation|refuge|shelter|assembly|recovery|cyclone/i],
  ['sandbag', /sandbag|sand bag/i],
]

/** Which map symbol a council's centre type gets. */
export function centreKind(type: string): CentreKind {
  return KINDS.find(([, re]) => re.test(type))?.[0] ?? 'other'
}
