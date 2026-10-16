import { describe, expect, it } from 'vitest'
import { buildDirectory, distanceKm, slugify, type DirectoryInput } from './directory.ts'
import { directoryPages, lineTitle } from './directoryPages.ts'

// A toy network: Central (platforms 1 and 2) and Bowen Hills on T1, a ferry
// terminal on F1, a turnback no route calls at, a bus stop on route 100 and a
// Townsville bus route, plus a gazetteer with two localities near Central.
const input: DirectoryInput = {
  core: {
    stops: {
      SEQ: [
        ['place_censta', 'Central station', -27.4659, 153.0258, 0, 0],
        ['600001', 'Central station, platform 1', -27.4659, 153.0258, 'place_censta', '1'],
        ['600002', 'Central station, platform 2', -27.4659, 153.0258, 'place_censta', '2'],
        ['place_bowsta', 'Bowen Hills station', -27.4418, 153.0338, 0, 0],
        ['317590', 'Riverside ferry terminal', -27.4669, 153.0313, 0, 0],
        ['600854', 'Cavill Avenue turnback', -28.0034, 153.4287, 0, 0],
      ],
    },
  },
  others: [{ stops: { SEQ: [['1234', 'Adelaide Street, stop 1', -27.467, 153.026, 0, 0]], TSV: [['890001', 'Flinders Street', -19.26, 146.81, 0, 0]] } }],
  routes: {
    routes: {
      'SEQ:BRCA': { short: 'BRCA', long: 'Brisbane City - Caboolture', mode: 'train', line: 'T1 Caboolture', url: 'https://example/t1' },
      'SEQ:CABR': { short: 'CABR', long: 'Caboolture - Brisbane City', mode: 'train', line: 'T1 Caboolture' },
      'SEQ:F1': { short: 'F1', long: 'Northshore Hamilton / UQ St Lucia', mode: 'ferry' },
      'SEQ:100': { short: '100', long: 'City - Forest Lake', mode: 'bus' },
      'TSV:V200': { short: '200', long: 'Ferry Terminal - City', mode: 'bus' },
    },
  },
  index: {
    regions: {
      SEQ: { routes: ['BRCA', 'CABR', 'F1', '100'], stops: { '600001': '0', '600002': '1', place_censta: '0.1', place_bowsta: '0.1', '317590': '2', '1234': '3', '600854': '0' } },
      TSV: { routes: ['V200'], stops: { '890001': '0' } },
    },
  },
  places: { places: [['Spring Hill', 153.023, -27.461, 'Brisbane City'], ['Townsville City', 146.817, -19.258, 'Townsville City'], ['Spring Hill', 150, -25, 'Elsewhere Shire']] },
}
const dir = buildDirectory(input)

describe('buildDirectory', () => {
  it('lists every station a route calls at, by name, with its mode, platforms and lines, and skips turnbacks', () => {
    expect(dir.stations.map((s) => s.slug)).toEqual(['bowen-hills-station', 'central-station', 'riverside-ferry-terminal'])
    const central = dir.stations[1]
    expect(central).toMatchObject({ id: 'place_censta', region: 'SEQ', mode: 'train', platforms: ['1', '2'], lines: ['t1-caboolture'], position: [153.0258, -27.4659] })
    expect(dir.stations[2]).toMatchObject({ mode: 'ferry', lines: ['seq-f1'] })
  })

  it('makes one line per official T-line and one per other route, each knowing its stations and other stops', () => {
    expect(dir.lines.map((l) => l.slug)).toEqual(['t1-caboolture', 'seq-f1', 'seq-100', 'tsv-200'])
    expect(dir.lines[0]).toMatchObject({ codes: ['BRCA', 'CABR'], hash: 'transit/line/train/T1%20Caboolture', url: 'https://example/t1', stations: ['bowen-hills-station', 'central-station'], stops: [] })
    expect(dir.lines[2]).toMatchObject({ mode: 'bus', hash: 'transit/route/SEQ/100', stations: [], stops: ['Adelaide Street, stop 1'] })
    expect(dir.lines[3]).toMatchObject({ region: 'TSV', name: '200', hash: 'transit/route/TSV/V200', stops: ['Flinders Street'] })
  })

  it('keeps one locality per name, the first in the gazetteer, and links it to stations within 5 km, nearest first', () => {
    expect(dir.places.map((p) => [p.slug, p.council])).toEqual([
      ['spring-hill', 'Brisbane City'],
      ['townsville-city', 'Townsville City'],
    ])
    expect(dir.places[0].stations.map((s) => s.slug)).toEqual(['central-station', 'riverside-ferry-terminal', 'bowen-hills-station'])
    expect(dir.places[1].stations).toEqual([])
    expect(dir.stations[1].places.map((p) => p.name)).toEqual(['Spring Hill'])
  })
})

describe('slugify and distanceKm', () => {
  it('makes URL-safe slugs and measures published points', () => {
    expect(slugify('Maryborough–Hervey Bay (West)')).toBe('maryborough-hervey-bay-west')
    expect(distanceKm([153.0258, -27.4659], [153.0338, -27.4418])).toBeCloseTo(2.8, 1)
  })
})

describe('directoryPages', () => {
  const pages = directoryPages(dir)
  const page = (path: string) => pages.find((p) => p.path === path)!

  it('writes an index page per kind, then a page per station, line and place', () => {
    expect(pages.slice(0, 3).map((p) => p.path)).toEqual(['/stations/', '/lines/', '/places/'])
    expect(pages.length).toBe(3 + 3 + 4 + 2)
  })

  it('describes a station with its lines, nearby localities, JSON-LD and app link, in published terms only', () => {
    const p = page('/stations/central-station/')
    expect(p.markdown).toContain("Central station is a train station on TransLink's South East Queensland network, served by T1 Caboolture")
    expect(p.markdown).toContain('[T1 Caboolture](/lines/t1-caboolture/)')
    expect(p.markdown).toContain('[Spring Hill](/places/spring-hill/)')
    expect(p.markdown).toContain('in the Roadbeat app, not on this page')
    expect(p.open).toEqual({ hash: 'transit/stop/SEQ/place_censta', label: 'Open Central station in Roadbeat' })
    expect(p.jsonLd?.[0]).toMatchObject({ '@type': 'TrainStation', geo: { latitude: -27.4659, longitude: 153.0258 } })
    expect(page('/stations/riverside-ferry-terminal/').jsonLd?.[0]).toMatchObject({ '@type': 'BoatTerminal' })
    expect(p.crumbs.map((c) => c.path)).toEqual(['/', '/stations/', '/stations/central-station/'])
  })

  it('titles lines by their rider-facing name and lists their stops by name', () => {
    expect(lineTitle(dir.lines[0])).toBe('T1 Caboolture')
    expect(lineTitle(dir.lines[1])).toBe('F1 Northshore Hamilton / UQ St Lucia')
    expect(lineTitle(dir.lines[3])).toBe('Route 200 Ferry Terminal - City')
    const p = page('/lines/t1-caboolture/')
    expect(p.markdown).toContain('[Central station](/stations/central-station/)')
    expect(p.markdown).toContain('not in running order')
    expect(p.open?.hash).toBe('transit/line/train/T1%20Caboolture')
    expect(page('/lines/tsv-200/').open?.hash).toBe('transit/route/TSV/V200')
  })

  it('describes a place from the gazetteer and opens the locality view', () => {
    const p = page('/places/spring-hill/')
    expect(p.markdown).toContain('Spring Hill is a locality in the Brisbane City local government area')
    expect(p.markdown).toContain('[Central station](/stations/central-station/), Train station')
    expect(p.open).toEqual({ hash: 'place/locality/Spring%20Hill', label: 'Open Spring Hill in Roadbeat' })
    expect(p.jsonLd?.[0]).toMatchObject({ '@type': 'Place', containedInPlace: { name: 'Brisbane City' } })
    expect(page('/places/townsville-city/').markdown).toContain('No train station, tram stop or ferry terminal')
  })
})
