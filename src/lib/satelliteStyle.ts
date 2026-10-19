// How a satellite image sits in the base map, like a hybrid map: under the
// roads and place names, so the road network stays readable on top of cloud
// and land, with names switched to white on a dark outline (the base maps'
// grey text is meant for a pale map). Past the source's sharpest zoom the
// image fades out, so the street map takes over instead of a stretched blur.

/** The parts of a style layer these rules read. */
export interface StyleLayer {
  id: string
  type: string
  'source-layer'?: string
  layout?: Record<string, unknown>
}

/** The layer the image is drawn under: the first road (or boundary or label), so those stay above it. */
export function imageBeforeLayer(layers: StyleLayer[]): string | undefined {
  return layers.find((l) => l['source-layer'] === 'transportation' || l['source-layer'] === 'boundary' || l.type === 'symbol')?.id
}

/**
 * The base map's flat area fills drawn above the image, hidden until the image
 * has faded (`imageFadedZoom`): the image shows buildings and airports itself,
 * and OpenFreeMap's styles draw some after their first road or label (dark
 * draws `building` after `water_name`, every style draws `aeroway-area` after
 * a road or aeroway line), where they'd cover it. Only the base map's own vector layers are listed:
 * Roadbeat's GeoJSON layers have no `source-layer`, and its 3D buildings are a
 * `fill-extrusion` the reader turned on.
 */
export function coveringFills(layers: StyleLayer[], before: string | undefined): string[] {
  const start = before ? layers.findIndex((l) => l.id === before) : -1
  if (start < 0) return []
  return layers.slice(start).filter((l) => l.type === 'fill' && l['source-layer'] != null && l['source-layer'] !== 'transportation').map((l) => l.id)
}

/** Text paint for labels over imagery: white on a dark outline. */
export const LABEL_PAINT = {
  'text-color': '#ffffff',
  'text-halo-color': 'rgba(0, 0, 0, 0.85)',
  'text-halo-width': 1.6,
  'text-halo-blur': 0.4,
} as const

/** The base map's text layers, whose paint is swapped while an image is shown. */
export function labelLayers(layers: StyleLayer[]): string[] {
  return layers.filter((l) => l.type === 'symbol' && l.layout?.['text-field'] != null).map((l) => l.id)
}

/**
 * The image's opacity by zoom: fully opaque up to one zoom past the source's
 * sharpest (MapLibre overzooms that far cleanly), then fading to 0.15 three
 * zooms later, where the street map shows through.
 */
export function imageOpacity(maxzoom: number): unknown {
  return ['interpolate', ['linear'], ['zoom'], maxzoom + 1, 1, imageFadedZoom(maxzoom), 0.15]
}

/** The zoom where the image has faded and the street map, buildings and all, takes over. */
export const imageFadedZoom = (maxzoom: number) => maxzoom + 4
