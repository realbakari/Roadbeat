import { describe, expect, it } from 'vitest'
import { toCouncilCamera } from './councilCameras'

const ipswich = { council: 'Ipswich City Council', area: 'Ipswich City', page: 'https://disaster.ipswich.qld.gov.au', feed: 'https://disaster.ipswich.qld.gov.au' }
const listing = { id: 174, description: 'Brisbane River - Goodna Boat Ramp, Goodna', type: 'Flood Camera', locality: 'Goodna', direction: null, image: 'https://portal.sightmaster.com.au/latest/3211', position: [152.90006, -27.60364] as [number, number] }

describe('toCouncilCamera', () => {
  it("keeps a council's own camera, typed by the council's words", () => {
    expect(toCouncilCamera(ipswich, listing)).toMatchObject({ council: 'Ipswich City Council', kind: 'floodcam', description: listing.description, image: listing.image, dashboard: ipswich.page })
    expect(toCouncilCamera(ipswich, { ...listing, type: 'Traffic Cameras (check image date)' })?.kind).toBe('webcam')
  })

  it("leaves out cameras QLDTraffic already publishes", () => {
    expect(toCouncilCamera(ipswich, { ...listing, image: 'https://cameras.qldtraffic.qld.gov.au/x.jpg' })).toBeNull()
  })
})
