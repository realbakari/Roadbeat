import { describe, expect, it } from 'vitest'
import type { Camera } from '../api/types'
import type { CouncilCentre } from '../api/newsTypes'
import type { FuelStation } from '../api/fuelAvailability'
import type { QldWarning } from '../api/qldWarnings'
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
  towns: null,
  lines: null,
  warnings: null,
  fuel: null,
  speedCameras: null,
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

  it('groups hits by kind, the group with the best match first: names before places', () => {
    const groups = groupHits(search(sources, 'Goodna'))
    // The camera, rest area and centre are named Goodna; the road event and story are only in it.
    expect(groups.map((g) => g.kind)).toEqual(['camera', 'place', 'centre', 'event', 'news'])
    expect(groups.every((g) => g.hits.length === 1)).toBe(true)
  })

  it('ranks a match in the name above a match only in the place', () => {
    const s: SearchSources = { ...EMPTY, towns: [{ name: 'Orion', council: 'Central Highlands Regional', position: [148, -24] }], stops: stopIndex() }
    expect(search({ ...s, towns: [...s.towns!, { name: 'Central', council: 'Somewhere', position: [0, 0] }] }, 'Central')[0].title).toBe('Central')
  })
})

describe('search over the newer sources', () => {
  const station: FuelStation = { id: '61470034', name: 'Mobil Gordonvale', brand: 'Mobil', address: '67 George St, Gordonvale', postcode: 4865, council: 'Cairns Regional', status: 'unavailable', updatedAt: null, fuels: [], position: [145.8, -17.1] }
  const warning = { id: 'W1', level: 'Advice', levelText: 'Advice', title: 'ADVICE - Isisford', issued: null, type: 'Flood', area: 'Isisford', from: 'Longreach Regional Council', callToAction: null, header: null, impacts: null, shouldDo: null, moreInformation: null, nextUpdate: null, position: [144.4, -24.3], areaShape: null } as QldWarning
  const newer: SearchSources = {
    ...EMPTY,
    towns: [{ name: 'Gordonvale', council: 'Cairns Regional', position: [145.8, -17.1] }],
    lines: [{ mode: 'train', name: 'T1 Caboolture', status: 'Good service', link: '', region: 'SEQ' }],
    warnings: [warning],
    fuel: [station],
    speedCameras: [{ id: 'fixed-1', type: 'fixed', site: 'Airport Link Tunnel (Northbound), Windsor', position: [153.03, -27.43] }],
  }

  it('finds a town first, with its council, and opens its place page', () => {
    const hits = search(newer, 'Gordonvale')
    expect(hits[0]).toEqual({ kind: 'town', title: 'Gordonvale', detail: 'Cairns Regional', href: 'place/locality/Gordonvale' })
    expect(hits.map((h) => h.kind)).toEqual(['town', 'fuel'])
  })

  it('finds a Translink line, a warning, a fuel station and a speed camera site, each at its own page', () => {
    expect(search(newer, 'Caboolture')[0]).toMatchObject({ kind: 'line', detail: 'Train line · Status: Good service', href: 'transit/line/train/T1%20Caboolture' })
    expect(search(newer, 'Isisford')[0]).toMatchObject({ kind: 'warning', detail: 'Advice · Flood · Longreach Regional Council', href: 'place/warning/W1' })
    expect(search(newer, 'Mobil')[0]).toMatchObject({ kind: 'fuel', title: 'Mobil Gordonvale', detail: 'No fuel available · 67 George St, Gordonvale' })
    expect(search(newer, 'Airport Link')[0]).toMatchObject({ kind: 'speedcamera', detail: 'Fixed speed camera', href: 'place/speedcamera/fixed-1' })
  })
})

describe('unloadedLayers', () => {
  it('names the layers whose data is not loaded', () => {
    expect(unloadedLayers(sources)).toEqual([
      'Storm, flood and cyclone warnings',
      'Fuel at service stations',
      'Speed and red light cameras',
      'Outages',
      'Air quality',
      'Gauges',
      'Low clearances',
      'Public toilets',
      'Accessible parking',
      'Parking meters',
      'Bikeways',
      'Council events',
    ])
    const all = { warnings: [], fuel: [], speedCameras: [], outages: [], airStations: [], gauges: [], clearances: [], toilets: [], bays: [], meters: [], bikeStops: [], councilEvents: [] }
    expect(unloadedLayers({ ...sources, ...all })).toEqual([])
  })
})

describe('words', () => {
  it('lower-cases, drops accents and splits on punctuation', () => {
    expect(words("Ipswich Mwy & Brisbane Tce, Goodna – Réserve")).toEqual(['ipswich', 'mwy', 'brisbane', 'tce', 'goodna', 'reserve'])
  })
})
