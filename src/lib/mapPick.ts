/** The parts of a rendered map feature a tap needs. */
export interface TapFeature {
  layer: { id: string; type: string }
  properties: Record<string, unknown> | null
}

export type TapTarget = { kind: 'event'; id: number } | { kind: 'key'; key: string } | null

/** Markers beat lines, and lines beat filled areas, which can lie over them. */
const RANK: Record<string, number> = { fill: 2, line: 1 }

/**
 * What one tap opens: a single feature, never one per layer under the point.
 * `features` are in the order the map reports them, topmost first. A marker
 * or line wins over an area, since a large area (a bushfire warning, an
 * outage) would otherwise take every tap inside it; then the topmost wins.
 */
export function pickTap(features: TapFeature[], eventLayers: string[]): TapTarget {
  const f = pickTop(features.filter((x) => x.properties && (eventLayers.includes(x.layer.id) || x.properties.key)))
  if (!f) return null
  return eventLayers.includes(f.layer.id) ? { kind: 'event', id: Number(f.properties!.id) } : { kind: 'key', key: String(f.properties!.key) }
}

/** The feature a tap or hover means among `features` (topmost first): the topmost of the best rank. */
export function pickTop<T extends TapFeature>(features: T[]): T | null {
  let best: { f: T; rank: number } | null = null
  for (const f of features) {
    const rank = RANK[f.layer.type] ?? 0
    if (!best || rank < best.rank) best = { f, rank }
  }
  return best?.f ?? null
}
