// Builds src/data/qld-places.json: the populated place names the news monitor
// locates reports by, from the Department of Resources' *Place names gazetteer -
// Queensland* (data.qld.gov.au, CC BY 4.0). Only towns, suburbs, localities and
// neighbourhoods are kept, each at the gazetteer's own point for that name.
// Run with `npm run data:places` when the gazetteer is republished.
//
// A name is left out when it can't place a report on its own:
// - The gazetteer gives it two or more points of the same kind in different
//   places (The Gap is in Brisbane, the Gold Coast, Gympie and Maranoa).
// - It is an everyday English word, a common first name or surname, or a better
//   known place in another state or country (COMMON below), so a capitalised
//   headline word would place a report somewhere the report doesn't mean.
// Such a name is kept instead under its council area, as "Carina (Brisbane City)",
// the form the gazetteer itself uses for some names, wherever that council has
// one point for it. Energex names a suburb with its council, so its outages
// can still be placed; a headline never writes the name that way.
import { writeFileSync } from 'node:fs'
import { parseCsv } from './lib/gtfs.mjs'

const GAZETTEER =
  'https://www.data.qld.gov.au/dataset/bd13d3a3-5470-437b-8d43-54d166907296/resource/414391b9-7943-4fc3-a237-a1ac57b75aab/download/queensland_place_names_gazetteer.csv'

// Gazetteer feature types, best first: a population centre's point is the town
// itself, where a locality's point is somewhere inside its boundary.
const TYPES = ['POPL', 'SUB', 'LOCB', 'LOCU', 'NBHD']

const COMMON = new Set(
  `Alice Allan Amber Ambrose Amity Auburn Bamboo Banana Barnard Basalt Begonia Bell Belvedere Berserker Bluff Boatman Bogie
  Breakaway Brightly Bungalow Burbank Burnside Burton Calcium Carina Cashmere Cassowary Cavern Chandler Cinnabar Clarendon
  Cockatoo Comet Corella Cremorne Creekside Crossroads Croydon Deepwater Dingo Dixie Dogwood Doughboy Draper Dromedary Duchess
  Dunk Emmet Enterprise Eureka Evergreen Fairyland Fanning Federal Fisher Fletcher Freestone Fulham Glebe Gore Grange
  Greenstone Greenwood Gridiron Griffin Grindstone Gunpowder Haystack Hector Homestead Horn Hurricane Ingleside Ironbark Ironside
  Jubilee Kensington Kerry Kirk Lakeland Lakeside Lansdowne Laura Limestone Linden Lizard Lyra Magnolia Maidenhead Manly
  Marathon Maroon Millstream Moorland Motley Newmarket Nobby Oakwood Orient Palmer Palmyra Pampas Paradise Pasha Pelican
  Perseverance Pimlico Pimple Pinnacle Pioneer Porcupine Prairie Prospect Racecourse Redwood Richmond Rosella Rosehill Sabine
  Sapphire Sexton Shaw Silverleaf Silverwood Sorrento Speedwell Springwood Sumner Sunset Syndicate Tableland Thane Tivoli
  Toll Topaz Underwood Veteran Vincent Ward Warner Whetstone Whiteside Woodbine Woolshed`.split(/\s+/),
)

const rows = parseCsv((await (await fetch(GAZETTEER, { redirect: 'follow' })).text()).replace(/^﻿/, ''))
const byName = new Map()
for (const r of rows) {
  const rank = TYPES.indexOf(r.Type)
  const lng = +r['Longitude DD']
  const lat = +r['Latitude DD']
  if (rank < 0 || !Number.isFinite(lng) || !Number.isFinite(lat) || r.Status !== 'Y' || r.Currency !== 'Y') continue
  const name = r['Place name'].trim()
  const list = byName.get(name) ?? []
  list.push({ rank, lng, lat, lga: r['LGA name'].trim() })
  byName.set(name, list)
}

/** The one best point in a list, or null when its best kind has two or more points. */
function single(list) {
  const best = Math.min(...list.map((p) => p.rank))
  const top = list.filter((p) => p.rank === best)
  return new Set(top.map((p) => `${p.lng},${p.lat}`)).size > 1 ? null : top[0]
}
const row = (name, p) => [name, +p.lng.toFixed(5), +p.lat.toFixed(5), p.lga]

const places = []
let ambiguous = 0
let common = 0
let qualified = 0
for (const [name, list] of byName) {
  const p = COMMON.has(name) ? null : single(list)
  if (p) {
    places.push(row(name, p))
    continue
  }
  if (COMMON.has(name)) common++
  else ambiguous++
  for (const lga of new Set(list.map((q) => q.lga))) {
    const inLga = lga && !byName.has(`${name} (${lga})`) ? single(list.filter((q) => q.lga === lga)) : null
    if (inLga) {
      places.push(row(`${name} (${lga})`, inLga))
      qualified++
    }
  }
}
places.sort((a, b) => a[0].localeCompare(b[0]))
if (places.length < 3000) throw new Error(`Only ${places.length} places; expected about 4,000`)

const out = {
  source: 'Department of Resources, Place names gazetteer - Queensland, data.qld.gov.au (CC BY 4.0)',
  generated: new Date().toISOString().slice(0, 10),
  places,
}
writeFileSync(new URL('../src/data/qld-places.json', import.meta.url), JSON.stringify(out))
console.log(`${places.length} places kept; ${ambiguous} names with more than one point and ${common} common words kept only under their council (${qualified} entries)`)
