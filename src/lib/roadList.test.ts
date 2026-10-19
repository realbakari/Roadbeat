import { describe, expect, it } from 'vitest'
import type { TrafficEvent } from '../api/types'
import { roadEvent } from '../test/fixtures'
import { roadListGroups, roadListHtml } from './roadList'

const now = Date.parse('2026-10-19T12:00:00+10:00')
const closed = { direction: 'Both directions', towards: null, impact_type: 'Closures', impact_subtype: 'Road closed to all traffic', delay: null }
const ev = (id: number, road: string, district: string, over: Partial<TrafficEvent['properties']> = {}): TrafficEvent => {
  const e = roadEvent(id, road, 'Gympie')
  return { ...e, properties: { ...e.properties, road_summary: { ...e.properties.road_summary!, district }, last_updated: '2026-10-19T09:00:00+10:00', ...over } }
}
const later = { start: '2026-11-01T07:00:00+10:00', end: '2026-11-02T17:00:00+10:00', active_days: null, recurrences: null }
const events = [
  ev(1, 'Bruce Highway', 'Wide Bay/Burnett'),
  ev(2, 'Bruce Highway', 'Wide Bay/Burnett', { impact: closed, event_priority: 'Low' }),
  ev(3, 'Albert Street', 'Metropolitan', { description: 'Lane <closed> & cones' }),
  ev(4, 'Future Road', 'Metropolitan', { event_type: 'Roadworks', duration: later }),
]

describe('roadListGroups', () => {
  it('groups current events by district and road, A to Z, closures first', () => {
    const g = roadListGroups(events, now)
    expect(g.map((d) => [d.district, d.roads.map((r) => [r.road, r.events.map((e) => e.properties.id)])])).toEqual([
      ['Metropolitan', [['Albert Street', [3]]]],
      ['Wide Bay/Burnett', [['Bruce Highway', [2, 1]]]],
    ])
  })

  it('narrows to a district or to closures', () => {
    expect(roadListGroups(events, now, { closuresOnly: true }).flatMap((d) => d.roads.flatMap((r) => r.events.map((e) => e.properties.id)))).toEqual([2])
    expect(roadListGroups(events, now, { district: 'Metropolitan' }).map((d) => d.district)).toEqual(['Metropolitan'])
  })
})

describe('roadListHtml', () => {
  it('prints the read time in Brisbane time, escapes published text, and links each event to the map', () => {
    const html = roadListHtml(events, Date.parse('2026-10-19T02:14:00Z'), now)
    expect(html).toContain('12:14 pm')
    expect(html).toContain('Lane &lt;closed&gt; &amp; cones')
    expect(html).toContain('<a href="/#event/2">On the map</a>')
    expect(html).toContain('<strong>Road closed to all traffic · Both directions</strong>')
    expect(html).toContain('3 events.')
  })

  it('says so in words when nothing matches, rather than showing an empty list', () => {
    expect(roadListHtml([], now, now, { closuresOnly: true })).toContain('QLDTraffic lists no road closures right now.')
  })
})
