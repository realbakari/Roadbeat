import type { NewsItem, NewsRoad } from '../api/newsTypes.js'
import type { RoadSegment } from '../api/qldRoads.js'

// Road names in news text, and the official segments that place them. A road
// is placed only inside a locality the same text names, so "Warrego Highway"
// alone is never drawn across 700 km, but "Warrego Highway, Gatton" is.

/** Road types as Queensland's roads dataset spells them, with the abbreviations news text uses. */
const ROAD_TYPES: Record<string, string[]> = {
  Street: ['St'],
  Road: ['Rd'],
  Avenue: ['Ave', 'Av'],
  Boulevard: ['Bvd', 'Blvd'],
  Drive: ['Dr'],
  Highway: ['Hwy'],
  Motorway: ['Mwy'],
  Freeway: ['Fwy'],
  Parade: ['Pde'],
  Terrace: ['Tce'],
  Esplanade: ['Esp'],
  Crescent: ['Cres', 'Cr'],
  Court: ['Ct'],
  Place: ['Pl'],
  Close: ['Cl'],
  Circuit: ['Cct'],
  Lane: ['La'],
  Way: [],
  Bypass: [],
}
const TYPE_BY_WORD = new Map(Object.entries(ROAD_TYPES).flatMap(([type, abbrs]) => [[type, type], ...abbrs.map((a) => [a, type] as const)]))

// Capitalised words that start a sentence or phrase rather than a road's name.
const LEADING = new Set(['The', 'A', 'On', 'In', 'At', 'Along', 'Near', 'Off', 'Onto', 'Into', 'From', 'To', 'Via', 'And', 'Of', 'Northbound', 'Southbound', 'Eastbound', 'Westbound'])
const NAME_WORD = /^[A-Z][a-z'’]+(-[A-Z][a-z'’]+)?$/
const MAX_NAME_WORDS = 3

/**
 * Road names written in a text, as the roads dataset spells them: "Bruce Hwy"
 * becomes "Bruce Highway". A name is one to three capitalised words followed by
 * a road type. Leading words such as "The" or "Along" are dropped. Each name
 * appears once, in the order first written.
 */
export function roadNames(text: string): string[] {
  const words = text.split(/[^A-Za-z'’-]+/).filter(Boolean)
  const out: string[] = []
  words.forEach((word, i) => {
    const type = TYPE_BY_WORD.get(word)
    if (!type) return
    const name: string[] = []
    for (let j = i - 1; j >= 0 && name.length < MAX_NAME_WORDS && NAME_WORD.test(words[j]) && !TYPE_BY_WORD.has(words[j]); j--) name.unshift(words[j])
    while (name.length && LEADING.has(name[0])) name.shift()
    const full = name.length ? `${name.join(' ')} ${type}` : null
    if (full && !out.includes(full)) out.push(full)
  })
  return out
}

/** What to ask the roads dataset about an item: the roads it names and the gazetteer localities it names, or null if either is missing. */
export function roadQuestion(item: NewsItem): { names: string[]; localities: { name: string; lga: string | null }[] } | null {
  const names = roadNames(`${item.title}\n${item.summary ?? ''}`)
  const localities = item.places.filter((p) => p.via === 'gazetteer').map((p) => ({ name: p.name, lga: p.lga }))
  return names.length && localities.length ? { names, localities } : null
}

/**
 * The named roads inside the named localities, from the segments the roads
 * dataset returned. A segment counts for a locality on either side of it. Each
 * road and locality pair becomes one NewsRoad, in the order the text names roads.
 * A name found in localities of different council areas is most likely two
 * different roads, so it is not placed at all.
 */
export function roadsInLocalities(names: string[], localities: { name: string; lga: string | null }[], segments: RoadSegment[]): NewsRoad[] {
  return names.flatMap((name) => {
    const found = localities.flatMap((locality) => {
      const lines = segments.filter((s) => s.road === name && (s.localityLeft === locality.name || s.localityRight === locality.name)).map((s) => s.path)
      return lines.length ? [{ name, locality: locality.name, lga: locality.lga, lines }] : []
    })
    return new Set(found.map((r) => r.lga)).size > 1 ? [] : found
  })
}

/** The bounding box of a road's lines, for fitting the map to it. */
export function roadBounds(road: NewsRoad): [[number, number], [number, number]] {
  const points = road.lines.flat()
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ]
}
