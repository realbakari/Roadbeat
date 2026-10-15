// Builds public/qld-gauges.json: Queensland's open stream gauging stations, from
// the Department of Local Government, Water and Volunteers' stream gauging station
// network list (data.qld.gov.au "Queensland Water Monitoring Hydrology Data",
// CC BY 4.0), about 400 stations. Each station is checked against the Water
// Monitoring Information Portal's web service and kept only if it has a telemetered
// stream water level (datasource AT, variable 100), the trace /qld-gauges serves.
// Run with `npm run data:qld-gauges` when the department opens or closes stations.
import { writeFileSync } from 'node:fs'
import { parseCsv } from './lib/gtfs.mjs'

const STATIONS = 'https://www.data.qld.gov.au/dataset/aa2fc591-0a8f-4a9e-8c3a-22e2a2f69efb/resource/90d70cd5-ead5-4728-9743-15bd34d71222/download/stream-gauging-station-network.csv'
const SERVICE = 'https://water-monitoring.information.qld.gov.au/cgi/webservice.pl'

const rows = parseCsv(await (await fetch(STATIONS, { redirect: 'follow' })).text())
const stations = rows
  .filter((r) => /^[0-9A-Z]+$/.test(r.STATION) && Number.isFinite(+r.LATITUDE) && Number.isFinite(+r.LONGITUDE) && +r.LATITUDE !== 0)
  .map((r) => [r.STATION, r.STNAME.trim(), +r.LONGITUDE, +r.LATITUDE])
if (stations.length < 300) throw new Error(`Only ${stations.length} stations in the network list; expected about 400`)

// The service answers for all stations in one slow (~20 s) POST; a station with no AT stream height answers with an error.
const res = await fetch(SERVICE, {
  method: 'POST',
  body: JSON.stringify({
    function: 'get_latest_ts_values',
    version: '2',
    params: { site_list: stations.map((s) => s[0]).join(','), datasource: 'AT', trace_list: [{ varfrom: '100', varto: '100' }] },
  }),
})
const latest = await res.json()
if (latest.error_num !== 0) throw new Error(`Web service error ${latest.error_num}: ${latest.error_msg}`)
const live = stations.filter(([id]) => latest.return[id]?.some((t) => t.values))

const out = {
  source: 'Queensland Government, stream gauging station network and Water Monitoring Information Portal (CC BY 4.0)',
  generated: new Date().toISOString().slice(0, 10),
  stations: live,
}
writeFileSync(new URL('../public/qld-gauges.json', import.meta.url), JSON.stringify(out))
console.log(`${stations.length} stations in the network list, ${live.length} with a telemetered stream height`)
