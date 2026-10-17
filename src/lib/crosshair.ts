// The crosshair's readout: where the map's centre is, and what official items
// the map draws under it, by their own labels. Nothing is computed for the
// point itself (no model wind or elevation): only what a layer publishes.

export interface CrosshairItem {
  label: string
  key: string | null
}

/** "27.4698° S, 153.0251° E". */
export function formatPosition([lng, lat]: [number, number]): string {
  const ns = lat < 0 ? 'S' : 'N'
  const ew = lng < 0 ? 'W' : 'E'
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`
}

/** The labelled items under the crosshair, once each, at most `max`. */
export function crosshairItems(features: { label?: unknown; key?: unknown }[], max = 6): CrosshairItem[] {
  const seen = new Set<string>()
  const out: CrosshairItem[] = []
  for (const f of features) {
    if (typeof f.label !== 'string' || !f.label) continue
    const key = typeof f.key === 'string' ? f.key : null
    const id = key ?? f.label
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ label: f.label, key })
    if (out.length === max) break
  }
  return out
}
