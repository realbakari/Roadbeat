import { describe, expect, it } from 'vitest'
import { placeIndex } from './newsPlaces'
import { dedupeOutages, fromCouncilNotice, fromPowerOutage, outageFacts, outagePosition } from './outages'

const index = placeIndex([
  ['Chuwar', 152.79694, -27.56833, 'Ipswich City'],
  ['Richmond', 143.14, -20.73, 'Richmond Shire'],
  // As in src/data/qld-places.json: a plain name in another council, the
  // gazetteer's own qualified name, a common word kept under its council, and inner capitals.
  ['Red Hill', 145.93333, -18.18333, 'Cassowary Coast Regional'],
  ['Red Hill (Brisbane City)', 153.00389, -27.45111, 'Brisbane City'],
  ['Carina (Brisbane City)', 153.10111, -27.48583, 'Brisbane City'],
  ['McDowall', 152.99389, -27.37889, 'Brisbane City'],
])
const power = { event: 'INCD-987430-g', cause: 'Emergency Repairs', status: 'Awaiting', council: 'Ipswich City', suburb: 'CHUWAR', customers: 19, restore: 1792110600000, streets: ['ALLAWAH RD', 'MT CROSBY RD'] }

describe('fromPowerOutage', () => {
  it("places an Energex outage by its suburb's gazetteer point under Energex's council area", () => {
    const o = fromPowerOutage(power, index, 'https://disaster.ipswich.qld.gov.au')
    expect(o).toMatchObject({
      source: 'energex',
      council: 'Ipswich City',
      area: 'Ipswich City',
      type: 'Power',
      title: 'Emergency Repairs, Chuwar',
      status: 'Awaiting',
      customers: 19,
      streets: ['Allawah Rd', 'Mt Crosby Rd'],
      end: 1792110600000,
      place: { name: 'Chuwar', lga: 'Ipswich City', position: [152.79694, -27.56833], via: 'gazetteer' },
    })
    expect(outagePosition(o!)).toEqual([152.79694, -27.56833])
  })

  it('finds a suburb the gazetteer names under its council, as "Red Hill (Brisbane City)"', () => {
    const o = fromPowerOutage({ ...power, suburb: 'RED HILL', council: 'Brisbane City' }, index, 'x')
    expect(o).toMatchObject({ title: 'Emergency Repairs, Red Hill', area: 'Brisbane City', place: { name: 'Red Hill (Brisbane City)', position: [153.00389, -27.45111] } })
    expect(fromPowerOutage({ ...power, suburb: 'CARINA', council: 'Brisbane City' }, index, 'x')?.place?.name).toBe('Carina (Brisbane City)')
  })

  it('matches names with inner capitals whatever their case', () => {
    const o = fromPowerOutage({ ...power, suburb: 'MCDOWALL', council: 'Brisbane City' }, index, 'x')
    expect(o).toMatchObject({ title: 'Emergency Repairs, McDowall', place: { name: 'McDowall' } })
  })

  it("keeps an outage it can't place, with no position, rather than dropping it", () => {
    for (const o of [fromPowerOutage({ ...power, suburb: 'NOWHERE' }, index, 'x'), fromPowerOutage({ ...power, suburb: 'RICHMOND', council: 'Brisbane City' }, index, 'x')]) {
      expect(o).toMatchObject({ source: 'energex', place: null, geometry: null })
      expect(outagePosition(o)).toBeNull()
      expect(outageFacts(o)).toContain('Not on the map: suburb not found')
    }
    expect(fromPowerOutage({ ...power, suburb: 'NOWHERE' }, index, 'x').title).toBe('Emergency Repairs, Nowhere')
  })
})

describe('fromCouncilNotice and dedupeOutages', () => {
  const burdekin = { council: 'Burdekin Shire Council', area: 'Burdekin Shire', page: 'https://disaster.burdekin.qld.gov.au', feed: 'https://disaster.burdekin.qld.gov.au', icon: null }
  const notice = { id: 8104, type: 'Water', title: 'Lena Rd, Mount Kelly', details: 'Planned works.', incident: 'Planned', start: 1, end: 2, updated: 3, geometry: { type: 'LineString' as const, coordinates: [[147.315, -19.668], [147.314, -19.675]] } }

  it("keeps a council's notice at its published shape", () => {
    const o = fromCouncilNotice(burdekin, notice)
    expect(o).toMatchObject({ source: 'council', type: 'Water', title: 'Lena Rd, Mount Kelly', status: 'Planned', details: 'Planned works.', geometry: notice.geometry, place: null })
    expect(outagePosition(o)).toEqual([147.315, -19.668])
  })

  it('counts an Energex outage once however many dashboards relay it', () => {
    const a = fromPowerOutage(power, index, 'https://a')!
    const b = fromPowerOutage(power, index, 'https://b')!
    expect(dedupeOutages([a, b, fromCouncilNotice(burdekin, notice)])).toHaveLength(2)
  })
})
