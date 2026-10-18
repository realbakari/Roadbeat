import { Text } from '@cloudflare/kumo'
import { HOTSPOT_AGES, HOTSPOT_HOURS, HOTSPOTS_ATTRIBUTION, HOTSPOTS_PORTAL } from '../api/hotspots'
import { aestWithAge } from '../lib/aest'
import { feedNotice } from '../lib/feedNotice'
import { LayerFacts } from './LayerFacts'
import { InlineLink } from './ui/Links'

/** The hotspot layer's key and caveats, under its switch. */
export function HotspotsNote({ hasData, error, fetchedAt, newest, now }: { hasData: boolean; error: string | null; fetchedAt: number | null; newest: number | null; now: number }) {
  const notice = feedNotice('Satellite hotspots', hasData, error, fetchedAt)
  return (
    <div className="grid gap-1">
      <LayerFacts
        publisher="Geoscience Australia (DEA Hotspots)"
        cadence="As each satellite pass is processed; read every 10 minutes"
        latest={newest != null ? aestWithAge(newest, now) : hasData ? 'No detections in the last 24 hours' : null}
        latestLabel="Newest"
      />
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-kumo-subtle">
        {HOTSPOT_AGES.map((a) => (
          <span key={a.label} className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: a.color }} />
            {a.label}
          </span>
        ))}
      </div>
      {notice && (
        <Text size="xs" variant="error">
          {notice}
        </Text>
      )}
      <Text size="xs" variant="secondary">
        Heat a satellite detected in the last {HOTSPOT_HOURS} hours, from Geoscience Australia's{' '}
        <InlineLink href={HOTSPOTS_PORTAL}>DEA Hotspots</InlineLink>
        . A hotspot isn't a confirmed fire: it can be a bushfire, a planned burn or another heat source. Positions are within 375 m to 2 km, depending
        on the satellite. For warnings, follow the Queensland Fire Department. {HOTSPOTS_ATTRIBUTION}, CC BY 4.0.
      </Text>
    </div>
  )
}
