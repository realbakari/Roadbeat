import type { TrafficEvent } from '../api/types.js'
import { brisbaneDayDateTime } from './aest.js'
import { updateGap, updateGapText } from './eventAge.js'
import { isClosure, isCurrent } from './eventStatus.js'
import { eventTitle, impactLine } from './eventText.js'
import { clean } from './format.js'

// /roads: QLDTraffic's current road events as one plain HTML page, grouped by
// district and road, for slow connections and screen readers. No map, no app
// code, a few lines of CSS; the one small script only says how old a saved
// copy is and lets the browser keep one for when it's offline (public/sw.js).

export interface RoadListOptions {
  /** Only this district, as QLDTraffic names it. */
  district?: string
  closuresOnly?: boolean
}

const RANK: Record<string, number> = { 'Red Alert': 0, High: 1, Medium: 2, Low: 3 }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The districts QLDTraffic files current events under, A to Z, for the page's district links. */
export function roadListDistricts(events: TrafficEvent[], now: number): string[] {
  return [...new Set(events.filter((e) => isCurrent(e, now)).map((e) => clean(e.properties.road_summary?.district) ?? 'No district published'))].sort()
}

/** Current events, as the options narrow them, grouped by district and then road, A to Z; closures first within a road, then by priority. */
export function roadListGroups(events: TrafficEvent[], now: number, o: RoadListOptions = {}): { district: string; roads: { road: string; events: TrafficEvent[] }[] }[] {
  const byDistrict = new Map<string, Map<string, TrafficEvent[]>>()
  for (const e of events) {
    if (!isCurrent(e, now) || (o.closuresOnly && !isClosure(e))) continue
    const district = clean(e.properties.road_summary?.district) ?? 'No district published'
    if (o.district && district !== o.district) continue
    const road = eventTitle(e)
    const roads = byDistrict.get(district) ?? new Map<string, TrafficEvent[]>()
    roads.set(road, [...(roads.get(road) ?? []), e])
    byDistrict.set(district, roads)
  }
  const order = (a: TrafficEvent, b: TrafficEvent) => Number(isClosure(b)) - Number(isClosure(a)) || (RANK[a.properties.event_priority] ?? 9) - (RANK[b.properties.event_priority] ?? 9)
  return [...byDistrict]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([district, roads]) => ({ district, roads: [...roads].sort(([a], [b]) => a.localeCompare(b)).map(([road, list]) => ({ road, events: list.sort(order) })) }))
}

function eventItem(e: TrafficEvent, now: number): string {
  const p = e.properties
  const gap = updateGap(e, now)
  const updated = p.last_updated && Number.isFinite(Date.parse(p.last_updated)) ? `Updated ${brisbaneDayDateTime.format(Date.parse(p.last_updated))}` : null
  const lines = [
    `<strong>${esc(impactLine(e) ?? p.event_type)}</strong>`,
    [clean(p.road_summary?.locality), `${p.event_type}${clean(p.event_subtype) ? `, ${clean(p.event_subtype)}` : ''}`, `${p.event_priority} priority`].filter(Boolean).map((s) => esc(s!)).join(' · '),
    clean(p.description) && esc(clean(p.description)!),
    clean(p.advice) && `Advice: ${esc(clean(p.advice)!)}`,
    [updated, gap && updateGapText(gap)].filter(Boolean).join(' · '),
  ].filter(Boolean)
  return `<li>${lines.join('<br>')} <a href="/#event/${p.id}">On the map</a></li>`
}

/** The whole /roads page for the events read at `fetchedAt`, in Brisbane time. */
export function roadListHtml(events: TrafficEvent[], fetchedAt: number, now: number, o: RoadListOptions = {}): string {
  const groups = roadListGroups(events, now, o)
  const count = groups.reduce((n, g) => n + g.roads.reduce((m, r) => m + r.events.length, 0), 0)
  const link = (label: string, q: RoadListOptions, current: boolean) => {
    const params = new URLSearchParams()
    if (q.district) params.set('district', q.district)
    if (q.closuresOnly) params.set('closures', '1')
    const href = `/roads${params.size ? `?${params}` : ''}`
    return current ? `<strong>${esc(label)}</strong>` : `<a href="${esc(href)}">${esc(label)}</a>`
  }
  const filters = [
    link('All events', { district: o.district }, !o.closuresOnly),
    link('Closures only', { district: o.district, closuresOnly: true }, !!o.closuresOnly),
  ].join(' · ')
  const districts = [link('All districts', { closuresOnly: o.closuresOnly }, !o.district), ...roadListDistricts(events, now).map((d) => link(d, { district: d, closuresOnly: o.closuresOnly }, d === o.district))].join(' · ')
  const body = groups.length
    ? groups
        .map((g) => `<h2>${esc(g.district)}</h2>\n${g.roads.map((r) => `<h3>${esc(r.road)}</h3>\n<ul>${r.events.map((e) => eventItem(e, now)).join('\n')}</ul>`).join('\n')}`)
        .join('\n')
    : `<p>QLDTraffic lists no ${o.closuresOnly ? 'road closures' : 'road events'}${o.district ? ` in ${esc(o.district)}` : ''} right now.</p>`
  const at = brisbaneDayDateTime.format(fetchedAt)
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Road events, text only · Roadbeat</title>
<meta name="description" content="QLDTraffic's current road events across Queensland as a plain list by district and road, for slow connections.">
<style>
:root{color-scheme:light dark;font:16px/1.5 system-ui,sans-serif}
body{margin:0 auto;max-width:46rem;padding:1rem}
h1{font-size:1.4rem;margin:.2rem 0}h2{font-size:1.2rem;margin:1.6rem 0 .2rem;border-bottom:1px solid #8884}h3{font-size:1rem;margin:1rem 0 .2rem}
ul{padding-left:1.1rem;margin:.2rem 0}li{margin:.5rem 0}nav{margin:.4rem 0}.muted{opacity:.75;font-size:.9rem}
a{color:inherit}#age{font-weight:600}
</style>
</head>
<body>
<p class="muted"><a href="/">Roadbeat</a> · text only</p>
<h1>Road events across Queensland</h1>
<p>QLDTraffic's events as published, read at <time datetime="${new Date(fetchedAt).toISOString()}" id="at" data-at="${fetchedAt}">${esc(at)}</time> (AEST). ${count} ${o.closuresOnly ? (count === 1 ? 'closure' : 'closures') : count === 1 ? 'event' : 'events'}.</p>
<p id="age" hidden></p>
<nav aria-label="Show">${filters}</nav>
<nav aria-label="Districts" class="muted">${districts}</nav>
${body}
<hr>
<p class="muted">Source: Department of Transport and Main Roads, QLDTraffic (CC BY 4.0). Check conditions with Transport and Main Roads on 13 19 40 or at qldtraffic.qld.gov.au. In an emergency, call Triple Zero (000). The map, cameras, warnings and public transport are in <a href="/">the full app</a>.</p>
<script>
(function(){var t=+document.getElementById('at').dataset.at,m=Math.round((Date.now()-t)/60000),a=document.getElementById('age');
if(m>=5){a.hidden=false;a.textContent='This copy is '+(m<120?m+' minutes':Math.round(m/60)+' hours')+' old. Your connection may be down; reload for the latest.'}
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(function(){})})()
</script>
</body>
</html>
`
}
