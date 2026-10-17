import { describe, expect, it } from 'vitest'
import { parseFields, parseNswFires } from './nswFires'

// Cut down from the RFS majorIncidents.json of 17 October 2026.
const gibberagee = {
  type: 'Feature',
  geometry: { type: 'GeometryCollection', geometries: [{ type: 'Point', coordinates: [152.9, -29.25] }, { type: 'GeometryCollection', geometries: [] }] },
  properties: {
    title: 'OIL RIG RD, GIBBERAGEE',
    link: 'https://www.rfs.nsw.gov.au/fire-information/fires-near-me',
    category: 'Advice',
    guid: 'https://incidents.rfs.nsw.gov.au/api/v1/incidents/681150',
    pubDate: '16/10/2026 5:02:00 AM',
    description:
      'ALERT LEVEL: Advice <br />LOCATION: OIL RIG RD, GIBBERAGEE 2469 <br />COUNCIL AREA: Clarence Valley <br />STATUS: Under control <br />TYPE: Bush Fire <br />FIRE: Yes <br />SIZE: 1039 ha <br />RESPONSIBLE AGENCY: Forestry Corporation of NSW <br />UPDATED: 16 Oct 2026 16:02',
  },
}
const sydney = { ...gibberagee, geometry: { type: 'Point', coordinates: [150.9, -33.8] }, properties: { ...gibberagee.properties, title: 'SOMEWHERE, SYDNEY', guid: 'x/2' } }

describe('parseNswFires', () => {
  it('keeps incidents near the Queensland border with their published fields', () => {
    const [f] = parseNswFires({ type: 'FeatureCollection', features: [gibberagee, sydney] })
    expect(f).toMatchObject({ id: '681150', title: 'OIL RIG RD, GIBBERAGEE', alertLevel: 'Advice', position: [152.9, -29.25], published: '16/10/2026 5:02:00 AM' })
    expect(f.fields.slice(0, 4)).toEqual([
      ['Alert level', 'Advice'],
      ['Location', 'OIL RIG RD, GIBBERAGEE 2469'],
      ['Council area', 'Clarence Valley'],
      ['Status', 'Under control'],
    ])
    expect(parseNswFires({ features: [sydney] })).toEqual([])
  })

  it('drops incidents without a point and reads anything else as empty', () => {
    expect(parseNswFires({ features: [{ ...gibberagee, geometry: null }] })).toEqual([])
    expect(parseNswFires(null)).toEqual([])
  })
})

describe('parseFields', () => {
  it('skips empty fields and decodes entities', () => {
    expect(parseFields('STATUS: Going <br />SIZE: <br />LOCATION: A &amp; B')).toEqual([
      ['Status', 'Going'],
      ['Location', 'A & B'],
    ])
  })
})
