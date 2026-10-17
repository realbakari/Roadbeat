// Builds public/cyclone-tracks.json: past tropical cyclones that came near
// Queensland, from NOAA NCEI's International Best Track Archive for Climate
// Stewardship (IBTrACS v04r01, South Pacific basin, east of 135° E). Kept:
// storms since the 1980 season with a reported position inside the box below.
// Only positions the agencies reported are kept: IBTrACS also fills 3-hourly
// points by interpolation, and those (no "O" in IFLAG) are dropped, so the map
// never draws a position nobody observed. Recent seasons are provisional.
// Cite: Knapp et al. (2010), BAMS, doi:10.1175/2009BAMS2755.1; data doi:10.25921/82ty-9e16.
// Run with `npm run data:cyclones` once a season, after IBTrACS updates.
import { writeFileSync } from 'node:fs'
import { parseCsv } from './lib/gtfs.mjs'

const URL_ = 'https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.SP.list.v04r01.csv'
/** Queensland and its coastal waters: the Gulf of Carpentaria and the Coral Sea. */
const BOX = { west: 137, east: 160, north: -9, south: -30 }
const FIRST_SEASON = 1980

const text = await (await fetch(URL_)).text()
// The second line holds units; drop it.
const lines = text.split('\n')
const rows = parseCsv([lines[0], ...lines.slice(2)].join('\n'))

const num = (s) => (s != null && s.trim() !== '' && Number.isFinite(+s) ? +s : null)
const storms = new Map()
for (const r of rows) {
  if (r.TRACK_TYPE !== 'main' || +r.SEASON < FIRST_SEASON || !r.IFLAG?.includes('O')) continue
  const lat = num(r.LAT)
  const lng = num(r.LON)
  const t = Date.parse(`${r.ISO_TIME.replace(' ', 'T')}Z`)
  if (lat == null || lng == null || !Number.isFinite(t)) continue
  let s = storms.get(r.SID)
  if (!s) storms.set(r.SID, (s = { id: r.SID, name: /^(NOT_NAMED|UNNAMED)$/.test(r.NAME) ? null : r.NAME, season: +r.SEASON, agency: null, points: [], near: false }))
  const wind = num(r.WMO_WIND)
  if (r.WMO_AGENCY) s.agency ??= r.WMO_AGENCY
  s.points.push([+lng.toFixed(2), +lat.toFixed(2), Math.round(t / 1000), wind])
  if (lng >= BOX.west && lng <= BOX.east && lat <= BOX.north && lat >= BOX.south) s.near = true
}

const kept = [...storms.values()]
  .filter((s) => s.near && s.points.length >= 2)
  .map((s) => {
    const winds = s.points.map((p) => p[3]).filter((w) => w != null)
    const { id, season, agency, points } = s
    return { id, name: s.name ? s.name.charAt(0) + s.name.slice(1).toLowerCase() : null, season, agency, points, peakKt: winds.length ? Math.max(...winds) : null }
  })
  .sort((a, b) => b.season - a.season || a.id.localeCompare(b.id))
if (kept.length < 100) throw new Error(`Only ${kept.length} storms near Queensland; expected about 200`)

const out = {
  source: 'NOAA NCEI, International Best Track Archive for Climate Stewardship (IBTrACS v04r01), South Pacific basin',
  citation: 'Knapp et al. (2010), doi:10.1175/2009BAMS2755.1; IBTrACS v04r01 doi:10.25921/82ty-9e16',
  generated: new Date().toISOString().slice(0, 10),
  /** Each point: [longitude, latitude, time in seconds since the epoch (UTC), WMO-agency wind in knots or null]. */
  storms: kept,
}
writeFileSync(new URL('../public/cyclone-tracks.json', import.meta.url), JSON.stringify(out))
console.log(`${storms.size} storms since ${FIRST_SEASON} in the basin, ${kept.length} near Queensland, ${kept.reduce((n, s) => n + s.points.length, 0)} reported positions`)
