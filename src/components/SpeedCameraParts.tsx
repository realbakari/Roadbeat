import { Text } from '@cloudflare/kumo'
import { CameraIcon, GaugeIcon, TrafficSignalIcon } from '@phosphor-icons/react'
import { MOBILE_CAMERA_SITES, SPEED_CAMERA_LABEL, SPEED_CAMERAS_PAGE, type SpeedCamera } from '../api/speedCameras'
import { feedNotice } from '../lib/feedNotice'
import { formatPosition } from '../lib/crosshair'
import { LAYER_COLOR } from '../lib/mapIcons'
import type { Feed } from '../hooks/useHazardFeeds'
import { ExternalLink, Header, Section } from './PlaceParts'

// The speed camera layer's note and a camera site's page, both from the
// Queensland Government's camera map.

const Out = ({ href, children }: { href: string; children: string }) => (
  <a href={href} target="_blank" rel="noreferrer" className="text-kumo-link underline decoration-1 underline-offset-2">
    {children}
  </a>
)

const COLOR: Record<SpeedCamera['type'], string> = {
  fixed: LAYER_COLOR.speedCamera,
  combined: LAYER_COLOR.redLightCamera,
  redlight: LAYER_COLOR.redLightCamera,
  p2p: LAYER_COLOR.p2pCamera,
}
const ICON = { fixed: CameraIcon, combined: CameraIcon, redlight: TrafficSignalIcon, p2p: GaugeIcon }

export function SpeedCamerasNote({ feed }: { feed: Feed<SpeedCamera[]> }) {
  const notice = feedNotice('Camera sites', feed.data != null, feed.error, feed.fetchedAt)
  return (
    <div className="grid gap-1">
      {notice && <Text size="xs" variant="error">{notice}</Text>}
      <Text size="xs" variant="secondary">
        Fixed speed, red light and point-to-point camera sites, from the <Out href={SPEED_CAMERAS_PAGE}>Queensland Government's camera map</Out>. Mobile
        cameras aren't shown: the state lists <Out href={MOBILE_CAMERA_SITES}>their sites</Out> by road and suburb only.
      </Text>
    </div>
  )
}

/** One camera site, as the state's map describes it. */
export function SpeedCameraBody({ c }: { c: SpeedCamera }) {
  return (
    <>
      <Header icon={ICON[c.type]} color={COLOR[c.type]} title={c.site || SPEED_CAMERA_LABEL[c.type]} subtitle={SPEED_CAMERA_LABEL[c.type]} />
      <Section title="Site">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-kumo-subtle">Type</dt>
          <dd>{SPEED_CAMERA_LABEL[c.type]}</dd>
          <dt className="text-kumo-subtle">Position</dt>
          <dd className="tabular-nums">{formatPosition(c.position)}</dd>
        </dl>
      </Section>
      {c.type === 'p2p' && (
        <Text size="sm" variant="secondary">
          A point-to-point section's average speed is measured between its two camera sites. The state's map gives the sites, not the road between them.
        </Text>
      )}
      <ExternalLink href={SPEED_CAMERAS_PAGE}>Speed and red light camera locations, qld.gov.au</ExternalLink>
    </>
  )
}
