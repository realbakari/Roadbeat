import type { TransitRegion } from './translink'

// Train, tram and ferry tracks from TransLink's published GTFS shapes, one
// feature per route code (see scripts/build-tracks.mjs). Fetched on demand.

export type Tracks = GeoJSON.FeatureCollection<
  GeoJSON.MultiLineString,
  { region: TransitRegion; code: string; mode: string; color: string | null }
>

let tracks: Promise<Tracks | null> | null = null
export function loadTracks() {
  tracks ??= fetch(`${import.meta.env.BASE_URL}transit-tracks.json`)
    .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? (r.json() as Promise<Tracks>) : null))
    .catch(() => ((tracks = null), null))
  return tracks
}

/** Bounding box of the SEQ tracks whose route code matches, or null if none do. */
export function trackBounds(t: Tracks, match: (code: string) => boolean): [[number, number], [number, number]] | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const f of t.features) {
    if (f.properties.region !== 'SEQ' || !match(f.properties.code)) continue
    for (const line of f.geometry.coordinates)
      for (const [x, y] of line) {
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x)
        y1 = Math.max(y1, y)
      }
  }
  return x0 === Infinity ? null : [[x0, y0], [x1, y1]]
}
