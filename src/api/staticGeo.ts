// GeoJSON files built into public/ (scripts/build-flood-2022.mjs,
// build-bikeways.mjs), fetched once per visit. A network failure is forgotten
// so the next time the layer is turned on tries again.

const files = new Map<string, Promise<GeoJSON.FeatureCollection | null>>()

export function loadStatic(path: string) {
  let hit = files.get(path)
  if (!hit) {
    hit = fetch(path)
      .then((r) => (r.ok ? (r.json() as Promise<GeoJSON.FeatureCollection>) : null))
      .catch(() => {
        files.delete(path)
        return null
      })
    files.set(path, hit)
  }
  return hit
}
