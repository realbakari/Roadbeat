import type { CameraListing } from '../api/councilDashboard.js'
import type { CouncilCamera } from '../api/newsTypes.js'
import type { CouncilDashboard } from './newsItems.js'

/** QLDTraffic publishes its own cameras in Roadbeat's camera feeds, so a dashboard's copy of one is left out. */
const QLDTRAFFIC_HOST = /^https?:\/\/(cameras\.)?qldtraffic\.qld\.gov\.au\//

/**
 * A council's camera listing as Roadbeat keeps it, or null when QLDTraffic
 * already publishes the camera. Councils name camera types in their own words
 * ("Traffic Cameras", "Flood Cameras (check image date)"): a type that says
 * traffic is a traffic camera, anything else a flood camera, which is what the
 * dashboards use them for.
 */
export function toCouncilCamera(d: CouncilDashboard, c: CameraListing): CouncilCamera | null {
  if (QLDTRAFFIC_HOST.test(c.image)) return null
  return {
    id: c.id,
    council: d.council,
    area: d.area,
    kind: /traffic/i.test(c.type ?? '') ? 'webcam' : 'floodcam',
    description: c.description,
    locality: c.locality,
    direction: c.direction,
    image: c.image,
    note: c.note,
    position: c.position,
    dashboard: d.page,
  }
}
