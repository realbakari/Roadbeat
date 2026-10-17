import type { NewsPlace } from '../api/newsTypes.js'

/** A gazetteer row as scripts/build-places.mjs writes it: name, longitude, latitude, council area. */
export type GazetteerRow = [string, number, number, string]

// Names of teams, mastheads and venues that contain a place name but don't say
// where a story happened. They are blanked out before matching.
const NOT_PLACES = [
  'Brisbane Times',
  'Brisbane Broncos',
  'Brisbane Lions',
  'Brisbane Roar',
  'Brisbane Heat',
  'Brisbane Bullets',
  'Brisbane Olympics',
  'Brisbane 2032',
  'Gold Coast Suns',
  'Gold Coast Titans',
  'Gold Coast Bulletin',
  'Townsville Bulletin',
  'Townsville Fire',
  'Cairns Post',
  'Cairns Taipans',
  'Toowoomba Chronicle',
  'Sunshine Coast Daily',
  'Sunshine Coast Lightning',
  'Redcliffe Dolphins',
  'Ipswich Jets',
]
const NOT_PLACES_RE = new RegExp(`\\b(${NOT_PLACES.map((s) => s.replace(/ /g, '\\s+')).join('|')})\\b`, 'g')
const MAX_WORDS = 6

export interface PlaceIndex {
  byName: Map<string, GazetteerRow>
  /** The same rows by lower-cased name, for sources that write names in capitals ("MCDOWALL"). */
  byLowerName: Map<string, GazetteerRow>
}

export function placeIndex(rows: GazetteerRow[]): PlaceIndex {
  return { byName: new Map(rows.map((r) => [r[0], r])), byLowerName: new Map(rows.map((r) => [r[0].toLowerCase(), r])) }
}

/**
 * Queensland places named in a text, by exact, case-sensitive match of whole
 * words against the gazetteer, longest name first: "Burpengary East" wins over
 * "Burpengary". A possessive ("Toowoomba's") or "-based" ("Cairns-based") still matches. Each place appears
 * once, in the order first named. Nothing is inferred: a text that names no
 * gazetteer place returns no places.
 */
export function locate(text: string, index: PlaceIndex): NewsPlace[] {
  const cleaned = text
    .replace(NOT_PLACES_RE, ' | ')
    .replace(/-(based|born|bound|area|wide)\b/g, '')
    // "Brisbane City Council" names Brisbane, not the suburb Brisbane City.
    .replace(/\s+(City|Regional|Shire)\s+Council\b/g, ' Council')
  const words = [...cleaned.matchAll(/[A-Za-z][A-Za-z'’-]*|[^A-Za-z\s]+/g)].map((m) =>
    m[0].replace(/['’]s$/, '').replace(/['’-]+$/, ''),
  )
  const out: NewsPlace[] = []
  const seen = new Set<string>()
  for (let i = 0; i < words.length; ) {
    let hit: GazetteerRow | undefined
    let len = 0
    for (let n = Math.min(MAX_WORDS, words.length - i); n >= 1 && !hit; n--) {
      const name = words.slice(i, i + n).join(' ')
      hit = /^[A-Z]/.test(name) ? index.byName.get(name) : undefined
      if (hit) len = n
    }
    if (!hit) {
      i++
      continue
    }
    if (!seen.has(hit[0])) {
      seen.add(hit[0])
      out.push({ name: hit[0], lga: hit[3], position: [hit[1], hit[2]], via: 'gazetteer' })
    }
    i += len
  }
  return out
}
