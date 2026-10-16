import { describe, expect, it } from 'vitest'
import type { Camera } from '../api/types'
import type { CouncilCentre } from '../api/newsTypes'
import { fireWarning, gazetteerPlace, newsItem, roadEvent, stopIndex } from '../test/fixtures'
import { groupStories } from './newsStories'
import { groupHits, PER_KIND, search, unloadedLayers, words, type SearchSources } from './search'

function camera(id: number, description: string, locality: string | null, council?: string): Camera {
  return {
    type: 'Feature',
    kind: 'webcam',
    ...(council ? { council } : {}),
    geometry: { type: 'Point', coordinates: [152.9, -27.6] },
    properties: { id, url: '', description, direction: null, district: 'Metropolitan', locality, postcode: null, image_url: '' },
  }
}

function centre(id: string, name: string, address: string | null): CouncilCentre {
  return { id, council: 'Ipswich City Council', area: 'Ipswich City', type: 'Evacuation Centre', name, address, status: 'Open', note: null, position: [152.9, -27.6], dashboard: 'https://example.com' }
}

/** Nothing loaded but the always-on lists. */
const EMPTY: SearchSources = {
  events: [],
  cameras: [],
  stops: null,
  restAreas: [],
  dumpPoints: [],
  truckRestrictions: [],
  clearances: null,
  toilets: null,
  bays: null,
  meters: null,
  bikeStops: null,
  councilEvents: null,
  stories: null,
  centres: null,
  outages: null,
  airStations: null,
  gauges: null,
  fires: null,
}

const sources: SearchSources = {
  ...EMPTY,
  events: [roadEvent(1, 'Ipswich Motorway', 'Goodna'), roadEvent(2, 'Bruce Highway', 'Gympie', { event_type: 'Roadworks' })],
  cameras: [camera(5, 'Goodna - Ipswich Motorway & Brisbane Tce', 'Goodna'), camera(7, 'Riverview camera', 'Riverview', 'Ipswich City Council')],
  stops: stopIndex(),
  restAreas: [{ id: 'ra1', name: 'Goodna rest area', type: 'RA', toilet: true, accessibleToilet: false, water: null, carBays: true, truckBays: null, heavyVehicle: false, coordinates: [152.9, -27.6] }],
  stories: groupStories([newsItem({ id: 'n1', title: 'Truck rolls on motorway', places: [gazetteerPlace('Goodna', 'Ipswich City')] }), newsItem({ id: 'n2', title: 'Gympie floods again', published: 1 })]),
  centres: [centre('c1', 'Goodna Community Centre', '33 Queen Street, Goodna')],
  fires: [fireWarning('WARN-1', 'Gympie Regional', 'Bushfire near Curra')],
}

describe('search', () => {
  it('finds a camera, a place, a news story and a centre for one locality together', () => {
    const kinds = search(sources, 'Goodna').map((h) => h.kind)
    expect(kinds.sort()).toEqual(['camera', 'centre', 'event', 'news', 'place'])
  })

  it('opens each hit at its existing hash route', () => {
    const hrefs = Object.fromEntries(search(sources, 'Goodna').map((h) => [h.kind, h.href]))
    expect(hrefs).toEqual({ event: 'event/1', camera: 'camera/webcam-5', place: 'place/rest/ra1', news: 'news/n1', centre: 'place/centre/c1' })
    expect(search(sources, 'Riverview')[0].href).toBe('camera/webcam-ipswich-city-council-7')
    expect(search(sources, 'Alpha')[0].href).toBe('transit/stop/SEQ/place_a')
    expect(search(sources, 'Curra')[0].href).toBe('fire/WARN-1')
  })

  it('matches whole words and their beginnings, not text inside a word', () => {
    expect(search(sources, 'GOOD').map((h) => h.title)).toContain('Goodna rest area')
    expect(search(sources, 'oodna')).toEqual([])
    expect(search(sources, 'g')).toEqual([])
  })

  it('needs every query word to match', () => {
    expect(search(sources, 'Goodna rest').map((h) => h.title)).toEqual(['Goodna rest area'])
    expect(search(sources, 'Goodna Gympie')).toEqual([])
  })

  it('ranks an exact name first, then a name beginning with the query, then word matches', () => {
    const s: SearchSources = {
      ...EMPTY,
      restAreas: [
        { ...sources.restAreas[0], id: 'a', name: 'Rest area at Goodna' },
        { ...sources.restAreas[0], id: 'b', name: 'Goodna' },
        { ...sources.restAreas[0], id: 'c', name: 'Goodna North' },
        { ...sources.restAreas[0], id: 'd', name: 'Old Goodnaville Road' },
      ],
    }
    expect(search(s, 'goodna').map((h) => h.title)).toEqual(['Goodna', 'Goodna North', 'Rest area at Goodna', 'Old Goodnaville Road'])
  })

  it('lists a station once, under its own name, never its platforms', () => {
    const hits = search(sources, 'station')
    expect(hits.map((h) => h.title)).toEqual(['Alpha station', 'Bravo station', 'Charlie station'])
    expect(hits.map((h) => h.detail)).toEqual(['Station', 'Station', 'Stop'])
  })

  it('caps results per kind', () => {
    const many: SearchSources = { ...EMPTY, events: Array.from({ length: 12 }, (_, i) => roadEvent(i, `Gympie Road ${i}`, 'Chermside')) }
    expect(search(many, 'Gympie')).toHaveLength(PER_KIND)
  })

  it('matches a story by the places and roads it names, and shows its publishers', () => {
    const hit = search(sources, 'Goodna').find((h) => h.kind === 'news')
    expect(hit).toMatchObject({ title: 'Truck rolls on motorway', detail: 'ABC' })
  })

  it('matches an event by its road, suburb and district', () => {
    expect(search(sources, 'Bruce').map((h) => h.title)).toEqual(['Bruce Highway'])
    expect(search(sources, 'Metropolitan').map((h) => h.kind)).toEqual(['event', 'event', 'camera', 'camera'])
  })

  it('groups hits by kind in display order', () => {
    const groups = groupHits(search(sources, 'Goodna'))
    expect(groups.map((g) => g.kind)).toEqual(['event', 'camera', 'place', 'news', 'centre'])
    expect(groups.every((g) => g.hits.length === 1)).toBe(true)
  })
})

describe('unloadedLayers', () => {
  it('names the layers whose data is not loaded', () => {
    expect(unloadedLayers(sources)).toEqual(['Outages', 'Air quality', 'Gauges', 'Low clearances', 'Public toilets', 'Accessible parking', 'Parking meters', 'Bikeways', 'Council events'])
    expect(unloadedLayers({ ...sources, outages: [], airStations: [], gauges: [], clearances: [], toilets: [], bays: [], meters: [], bikeStops: [], councilEvents: [] })).toEqual([])
  })
})

describe('words', () => {
  it('lower-cases, drops accents and splits on punctuation', () => {
    expect(words("Ipswich Mwy & Brisbane Tce, Goodna – Réserve")).toEqual(['ipswich', 'mwy', 'brisbane', 'tce', 'goodna', 'reserve'])
  })
})
