import type { GazetteerRow } from '../lib/newsPlaces'
import { findLocality, type Locality } from '../lib/locality'

// Queensland's place names gazetteer (Department of Resources, data.qld.gov.au,
// CC BY 4.0), as scripts/build-places.mjs writes it: 3,900 towns, suburbs and
// localities, each at the gazetteer's own point and under its council area.
// The file is about 220 KB, so it is loaded only when a locality page opens,
// in its own chunk, like the bus stops in stops.ts.

let loaded: Promise<Locality[]> | null = null

/** Every locality in the gazetteer, loaded once on first use. */
export function loadLocalities(): Promise<Locality[]> {
  loaded ??= import('../data/qld-places.json').then((m) =>
    (m.default.places as GazetteerRow[]).map(([name, lng, lat, council]) => ({ name, council, position: [lng, lat] })),
  )
  return loaded
}

/** The gazetteer locality with this name, loading the gazetteer if needed; null when no locality has it. */
export async function lookupLocality(name: string): Promise<Locality | null> {
  return findLocality(await loadLocalities(), name)
}
