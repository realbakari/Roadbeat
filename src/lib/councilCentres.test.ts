import { describe, expect, it } from 'vitest'
import { centreKind, mergeCentres, toCentre } from './councilCentres'

const redland = { council: 'Redland City Council', area: 'Redland City', page: 'https://dashboard.redland.qld.gov.au', feed: 'http://dashboard.redland.qld.gov.au' }
const listing = { name: 'Dunwich Council Depot', type: 'Sandbag Station', address: '11-37 Mitchell Cres, Dunwich QLD 4183', status: 'Operational', note: null, position: [153.4, -27.5] as [number, number] }

describe('toCentre', () => {
  it("keeps the listing as published, with its council, area and the dashboard people can open", () => {
    const c = toCentre(redland, listing)
    expect(c).toMatchObject({ ...listing, council: 'Redland City Council', area: 'Redland City', dashboard: 'https://dashboard.redland.qld.gov.au' })
    expect(c.id).toBe(toCentre(redland, { ...listing, status: 'Closed' }).id)
  })
})

describe('mergeCentres', () => {
  it("replaces the lists of councils that answered and keeps the others' last lists", () => {
    const old = toCentre(redland, listing)
    const logan = toCentre({ ...redland, council: 'Logan City Council', page: 'https://disaster.logan.qld.gov.au' }, listing)
    const reopened = toCentre(redland, { ...listing, name: 'Cleveland Depot' })
    expect(mergeCentres([old, logan], [reopened], new Set(['Redland City Council']))).toEqual([logan, reopened])
  })
})

describe('centreKind', () => {
  it("sorts councils' own type names into map symbols", () => {
    expect(['Evacuation Centre', 'Place of Refuge', 'Cyclone Shelter', 'Sandbag Filling Point', 'Sandbag Station', 'Community Hub'].map(centreKind)).toEqual([
      'shelter',
      'shelter',
      'shelter',
      'sandbag',
      'sandbag',
      'other',
    ])
  })
})
