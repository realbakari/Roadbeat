import { describe, expect, it } from 'vitest'
import type { Camera } from '../api/types'
import { asCameras, shortName } from './cameras'
import { toCouncilCamera } from './councilCameras'

describe('shortName', () => {
  it('drops the leading place from a QLDTraffic description', () => {
    expect(shortName('Archerfield - Ipswich Motorway & Granard Rd - North')).toBe('Ipswich Motorway & Granard Rd - North')
    expect(shortName('Goodna')).toBe('Goodna')
  })
})

const ipswich = { council: 'Ipswich City Council', area: 'Ipswich City', page: 'https://disaster.ipswich.qld.gov.au', feed: 'https://disaster.ipswich.qld.gov.au', icon: null }
const listing = { id: 174, description: 'Brisbane River - Goodna Boat Ramp, Goodna', type: 'Flood Camera', locality: 'Goodna', direction: null, image: 'https://portal.sightmaster.com.au/latest/3211', position: [152.90006, -27.60364] as [number, number] }

describe('asCameras', () => {
  const council = toCouncilCamera(ipswich, listing)!
  const tmr = (coordinates: [number, number], kind: Camera['kind'] = 'floodcam'): Camera => ({
    type: 'Feature',
    kind,
    geometry: { type: 'Point', coordinates },
    properties: { id: 1, url: '', description: 'TMR', direction: null, district: null, locality: null, postcode: null, image_url: 'https://cameras.qldtraffic.qld.gov.au/1.jpg' },
  })

  it("becomes a Camera credited to the council, with the council as its district", () => {
    const [c] = asCameras([council], [])
    expect(c.kind).toBe('floodcam')
    expect(c.council).toBe('Ipswich City Council')
    expect(c.properties).toMatchObject({ description: listing.description, district: 'Ipswich City Council', image_sourced_from: 'Ipswich City Council', image_url: listing.image })
  })

  it('is left out when a QLDTraffic camera of the same kind sits within 30 m', () => {
    expect(asCameras([council], [tmr([152.90010, -27.60360])])).toEqual([])
    expect(asCameras([council], [tmr([152.90010, -27.60360], 'webcam')])).toHaveLength(1)
    expect(asCameras([council], [tmr([152.95, -27.6])])).toHaveLength(1)
  })
})
