// Builds src/data/gauge-catchments.json: the Bureau of Meteorology flood warning
// catchment each Brisbane City Council stream gauge sits in, so a gauge page can
// link to BoM's flood warning for that area. Catchments come from BoM's National
// Flood Gauge Network (data.gov.au, CC BY 4.0). BoM's flood classification levels
// and warning text are not openly licensed, so the app links to them instead.
// Run with `npm run data:catchments` when BCC adds gauges or BoM redraws catchments.
import { writeFileSync } from 'node:fs'

const SENSORS =
  'https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/telemetry-sensors-rainfall-and-stream-heights-metadata/records?limit=100'
const CATCHMENTS = 'https://hosting.wsapi.cloud.bom.gov.au/arcgis/rest/services/flood/National_Flood_Gauge_Network/FeatureServer/1/query'

const { results } = await (await fetch(SENSORS)).json()
const gauges = {}
for (const s of results) {
  if (!/stream/i.test(s.sensor_type) || s.longitude == null) continue
  const q = new URLSearchParams({
    geometry: `${s.longitude},${s.latitude}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'dist_name,product_id',
    returnGeometry: 'false',
    f: 'json',
  })
  const { features } = await (await fetch(`${CATCHMENTS}?${q}`)).json()
  const f = features?.[0]?.attributes
  if (f?.product_id) gauges[s.sensor_id] = [f.dist_name, f.product_id]
}

const count = Object.keys(gauges).length
if (count < 10) throw new Error(`Only ${count} gauges matched a catchment; a source may have changed`)
writeFileSync(
  new URL('../src/data/gauge-catchments.json', import.meta.url),
  JSON.stringify({ source: 'Bureau of Meteorology, National Flood Gauge Network (CC BY 4.0)', generated: new Date().toISOString().slice(0, 10), gauges }),
)
console.log(`${count} gauges matched`)
for (const [name, n] of Object.entries(Object.values(gauges).reduce((m, [d]) => ((m[d] = (m[d] ?? 0) + 1), m), {}))) console.log(`  ${name}: ${n}`)
