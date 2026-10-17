import { afterEach, describe, expect, it, vi } from 'vitest'
import SAMPLES from '../test/qldWarnings.json'
import { fetchQldWarnings, issuedFromTitle, parsePolygonCoords, parseQldWarnings, warningFeatures, warningLevel } from './qldWarnings'

// `live` is StormWarnings.json as published on 17 October 2026. `february` is
// a Watch and Act flood warning from February 2026 in the same feed shape,
// its 299-point area cut to its first five points and closed.

afterEach(() => vi.unstubAllGlobals())

describe('parseQldWarnings', () => {
  it('keeps every published field the page shows, word for word', () => {
    const [w] = parseQldWarnings(SAMPLES.live)
    expect(w).toMatchObject({
      id: 'HN_15102026',
      level: 'Advice',
      levelText: 'Advice',
      title: 'ADVICE - STAY INFORMED - Isisford and Surrounding Area (Longreach) - DO NOT USE TREATED TAP WATER - Issued at 10:00am, Friday 16 October 2026.',
      issued: 'Issued at 10:00am, Friday 16 October 2026',
      type: 'Other',
      area: 'Isisford',
      from: 'Longreach Regional Council',
      callToAction: 'Other - Adv - Stay informed',
      nextUpdate: 'Monday 19 October 2026',
      position: [144.44344148638393, -24.259684640453134],
    })
    expect(w.header).toBe(SAMPLES.live.features[0].properties.Header)
    expect(w.shouldDo).toBe(SAMPLES.live.features[0].properties.ShouldDo)
    expect(w.impacts).toBe(SAMPLES.live.features[0].properties.Impacts)
    expect(w.moreInformation).toBe(SAMPLES.live.features[0].properties.MoreInformation)
  })

  it('draws the area from PolygonCoords, longitude first', () => {
    const [w] = parseQldWarnings(SAMPLES.live)
    expect(w.areaShape?.coordinates).toEqual([
      [
        [
          [144.405000075951, -24.230371143346],
          [144.486367568626, -24.2275534196566],
          [144.486024245872, -24.2848348702651],
          [144.404828414573, -24.286712513583],
          [144.405000075951, -24.230371143346],
        ],
      ],
    ])
  })

  it('never carries the feed regeneration times or account names', () => {
    const [w] = parseQldWarnings(SAMPLES.live)
    expect(JSON.stringify(w)).not.toMatch(/qps_piwu|2026-10-17T13:38/)
  })

  it('puts higher levels first', () => {
    const both = parseQldWarnings({ features: [...SAMPLES.live.features, ...SAMPLES.february.features] })
    expect(both.map((w) => [w.level, w.from])).toEqual([
      ['Watch and Act', 'Burdekin Shire Council'],
      ['Advice', 'Longreach Regional Council'],
    ])
    expect(both[0].issued).toBe('Issued at 5:00pm, Saturday 21 February 2026')
    expect(both[0].nextUpdate).toBe('As the situation changes.')
  })

  it('reads an empty feed as no warnings, and skips items it cannot place', () => {
    expect(parseQldWarnings({ type: 'FeatureCollection', features: [] })).toEqual([])
    expect(parseQldWarnings({ features: [{ geometry: null, properties: { UniqueID: 'x', WarningLevel: 'Advice' } }] })).toEqual([])
    expect(() => parseQldWarnings({ error: 'no' })).toThrow()
  })
})

describe('warningLevel', () => {
  it('matches the warning system levels by name only', () => {
    expect(warningLevel('Emergency Warning')).toBe('Emergency Warning')
    expect(warningLevel(' watch and act ')).toBe('Watch and Act')
    expect(warningLevel('Advice')).toBe('Advice')
    expect(warningLevel('Cancelled')).toBe('Other')
  })
})

describe('issuedFromTitle', () => {
  it('gives the issue time as the title writes it', () => {
    expect(issuedFromTitle('ADVICE - DO NOT ENTER FLOOD WATER - Croydon (LGA) - Flood - Issued at 9:45am, Thursday 19 February 2026')).toBe(
      'Issued at 9:45am, Thursday 19 February 2026',
    )
    expect(issuedFromTitle('ADVICE - Isisford')).toBeNull()
  })
})

describe('parsePolygonCoords', () => {
  it('reads several closed rings as several areas', () => {
    const a = '-1,1 -1,2 -2,2 -1,1'
    const b = '-5,5 -5,6 -6,6 -5,5'
    expect(parsePolygonCoords(`${a} ${b}`)?.coordinates).toHaveLength(2)
  })
  it('gives null for an unclosed ring or an unreadable pair', () => {
    expect(parsePolygonCoords('-1,1 -1,2 -2,2 -3,3')).toBeNull()
    expect(parsePolygonCoords('-1,1 -1,x -2,2 -1,1')).toBeNull()
    expect(parsePolygonCoords('')).toBeNull()
  })
})

describe('warningFeatures', () => {
  it('gives each warning its area and a marker, coloured by level, opening its page', () => {
    const fc = warningFeatures(parseQldWarnings(SAMPLES.live))
    expect(fc.features.map((f) => f.geometry.type)).toEqual(['MultiPolygon', 'Point'])
    expect(fc.features[1].properties).toMatchObject({ key: 'place/warning/HN_15102026', color: '#e8b400', label: 'Advice · Isisford' })
  })
})

describe('fetchQldWarnings', () => {
  it('reads the proxy and says when it is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(SAMPLES.live)))
    expect(await fetchQldWarnings()).toHaveLength(1)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })))
    await expect(fetchQldWarnings()).rejects.toThrow('not configured')
  })
})
