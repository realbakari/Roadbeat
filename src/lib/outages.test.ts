import { describe, expect, it } from 'vitest'
import { placeIndex } from './newsPlaces'
import { dedupeOutages, fromCouncilNotice, fromPowerOutage, outagePosition } from './outages'

const index = placeIndex([
  ['Chuwar', 152.79694, -27.56833, 'Ipswich City'],
  ['Richmond', 143.14, -20.73, 'Richmond Shire'],
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

  it("is not placed when the suburb isn't in the gazetteer, or is a different council's suburb of that name", () => {
    expect(fromPowerOutage({ ...power, suburb: 'NOWHERE' }, index, 'x')).toBeNull()
    expect(fromPowerOutage({ ...power, suburb: 'RICHMOND', council: 'Brisbane City' }, index, 'x')).toBeNull()
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
