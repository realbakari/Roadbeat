import { describe, expect, it } from 'vitest'
import { airStation, camera, councilCentre, fireWarning, gauge, gazetteerPlace, newsItem, outage, roadEvent } from '../test/fixtures'
import { atLocality, eventLocalities, findLocality, type Locality, localityIndex, type LocalitySources, nearestLocality, reportCount, townTitle } from './locality'
import { groupStories } from './newsStories'

const NOW = Date.parse('2026-10-16T08:00:00+10:00')

const goodna: Locality = { name: 'Goodna', council: 'Ipswich City', position: [152.8975, -27.6106] }
const list: Locality[] = [goodna, { name: 'Redbank', council: 'Ipswich City', position: [152.8675, -27.5983] }, { name: 'Toowoomba', council: 'Toowoomba Regional', position: [151.9539, -27.5606] }]

/** A point about `km` kilometres east of Goodna's gazetteer point. */
const east = (km: number): [number, number] => [goodna.position[0] + km / 98.6, goodna.position[1]]

const empty: LocalitySources = { events: [], fires: [], cameras: [], airStations: [], centres: [], outages: [], stories: [], gauges: [] }

describe('findLocality', () => {
  it('finds a name exactly, or ignoring case from a typed link', () => {
    expect(findLocality(list, 'Goodna')).toBe(goodna)
    expect(findLocality(list, 'goodna')).toBe(goodna)
    expect(findLocality(list, 'Goodnaville')).toBeNull()
  })
})

describe('nearestLocality', () => {
  it('picks the nearest gazetteer point within range, or nothing', () => {
    expect(nearestLocality(list, east(1), 5)?.locality).toBe(goodna)
    expect(nearestLocality(list, [152.88, -27.6], 5)?.locality.name).toBe('Redbank')
    expect(nearestLocality(list, [150, -20], 5)).toBeNull()
  })
})

describe('atLocality', () => {
  it('lists road events in effect filed under the locality, either of a pair', () => {
    const events = [
      roadEvent(1, 'Ipswich Motorway', 'Goodna'),
      roadEvent(2, 'Brisbane Terrace', 'Goodna / Redbank'),
      roadEvent(3, 'Ipswich Motorway', 'Redbank'),
      roadEvent(4, 'Ipswich Motorway', 'Goodna', { event_type: 'Roadworks', duration: { start: '2026-10-20T00:00:00+10:00', end: null, active_days: null, recurrences: null } }),
    ]
    expect(atLocality(goodna, { ...empty, events }, NOW).events.map((e) => e.properties.id)).toEqual([1, 2])
  })

  it('lists fires whose area, title or location names it as a whole word', () => {
    const fires = [fireWarning('a', 'Goodna and Redbank'), fireWarning('b', null, 'Grass fire near goodna'), fireWarning('c', 'Goodnaville')]
    expect(atLocality(goodna, { ...empty, fires }, NOW).fires.map((f) => f.id)).toEqual(['a', 'b'])
  })

  it('lists cameras filed under the locality or within 5 km of its point, nearest first', () => {
    const cameras = [camera(1, 'Redbank', east(4)), camera(2, 'Goodna', east(9)), camera(3, 'Redbank', east(6)), camera(4, null, east(1))]
    expect(atLocality(goodna, { ...empty, cameras }, NOW).cameras.map((c) => c.item.properties.id)).toEqual([4, 1, 2])
  })

  it('lists stations, centres and gauges within 5 km of its point, with their distance', () => {
    const r = atLocality(goodna, { ...empty, airStations: [airStation('far', east(8)), airStation('near', east(2))], centres: [councilCentre('c', east(4.9))], gauges: [gauge('g', east(5.1))] }, NOW)
    expect(r.airStations.map((a) => a.item.id)).toEqual(['near'])
    expect(r.airStations[0].km).toBeCloseTo(2, 1)
    expect(r.centres.map((c) => c.item.id)).toEqual(['c'])
    expect(r.gauges).toEqual([])
  })

  it('lists Energex outages by their suburb and never a council notice, which names none', () => {
    const outages = [outage('a', 'Goodna'), outage('b', 'Redbank'), outage('c', null)]
    expect(atLocality(goodna, { ...empty, outages }, NOW).outages.map((o) => o.id)).toEqual(['a'])
  })

  it('lists stories whose text names the locality, not ones placed by a source near it', () => {
    const stories = groupStories([
      newsItem({ id: 'x', title: 'Crash at Goodna', places: [gazetteerPlace('Goodna', 'Ipswich City', goodna.position)] }),
      newsItem({ id: 'y', title: 'Quake', kind: 'official', places: [{ name: 'Near Goodna', lga: null, position: goodna.position, via: 'source' }] }),
      newsItem({ id: 'z', title: 'Fire at Redbank', places: [gazetteerPlace('Redbank', 'Ipswich City')] }),
    ])
    expect(atLocality(goodna, { ...empty, stories }, NOW).stories.map((s) => s.id)).toEqual(['x'])
  })

  it('names the sources that are not loaded instead of guessing at them', () => {
    const r = atLocality(goodna, { ...empty, fires: null, airStations: null, gauges: null }, NOW)
    expect(r.notLoaded).toEqual(['fires', 'airStations', 'gauges'])
    expect(reportCount(r)).toBe(0)
  })

  it('tells a source whose read failed apart from one that is turned off', () => {
    const r = atLocality(goodna, { ...empty, fires: null, gauges: null, errors: { fires: 'The QFD feed responded with 502' } }, NOW)
    expect(r.failed).toEqual([{ source: 'fires', error: 'The QFD feed responded with 502' }])
    expect(r.notLoaded).toEqual(['gauges'])
  })
})

describe('eventLocalities', () => {
  const at = (name: string, council: string): Locality => ({ name, council, position: [0, 0] })
  const index = localityIndex([
    at('Desailly', 'Mareeba Shire'),
    at('Mount Carbine', 'Mareeba Shire'),
    at('Miva (Fraser Coast Regional)', 'Fraser Coast Regional'),
    at('Miva (Gympie Regional)', 'Gympie Regional'),
    at('Bunya', 'Moreton Bay City'),
    at('Tibooburra Creek', 'Bulloo Shire'),
  ])
  const names = (r: ReturnType<typeof eventLocalities>) => r.map((x) => [x.name, x.locality?.name ?? null])

  it('finds each place an event names, whatever case or council spelling it uses', () => {
    expect(names(eventLocalities(index, 'Desailly / Mount Carbine', 'Mareeba Shire'))).toEqual([['Desailly', 'Desailly'], ['Mount Carbine', 'Mount Carbine']])
    expect(names(eventLocalities(index, 'BUNYA', 'Moreton Bay Regional'))).toEqual([['BUNYA', 'Bunya']])
  })

  it('tells twins apart by the event’s council, and leaves them unlinked when it names neither', () => {
    expect(names(eventLocalities(index, 'Miva', 'Gympie Regional'))).toEqual([['Miva', 'Miva (Gympie Regional)']])
    expect(names(eventLocalities(index, 'Miva', 'Noosa Shire'))).toEqual([['Miva', null]])
  })

  it('links nothing for places QLDTraffic files under NSW, or that the gazetteer doesn’t have', () => {
    expect(names(eventLocalities(index, 'Bunya', 'Nsw'))).toEqual([['Bunya', null]])
    expect(names(eventLocalities(index, 'Tibooburra', 'Nsw'))).toEqual([['Tibooburra', null]])
    expect(eventLocalities(index, null, null)).toEqual([])
  })

  it('names twins without their council', () => {
    expect(townTitle(at('Miva (Gympie Regional)', 'Gympie Regional'))).toBe('Miva')
    expect(townTitle(at('Bunya', 'Moreton Bay City'))).toBe('Bunya')
  })
})
