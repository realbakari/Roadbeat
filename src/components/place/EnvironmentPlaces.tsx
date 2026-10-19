import { Text } from '@cloudflare/kumo'
import { FireSimpleIcon, WindIcon } from '@phosphor-icons/react'
import { Fragment, type ReactNode } from 'react'
import { AIR_COLOR, AIR_QUALITY_DATASET, AIR_RATINGS, AIR_TEXT, worstRating, type AirStation } from '../../api/airQuality'
import { HOTSPOT_COLOR, HOTSPOTS_ATTRIBUTION, HOTSPOTS_PORTAL, type Hotspot } from '../../api/hotspots'
import { brisbaneDayDateTime as when } from '../../lib/aest'
import { AirHistory } from '../AirHistory'
import { Header } from '../PlaceParts'
import { ExternalLink } from '../ui/Links'
import { Section } from '../ui/Section'
import { RelativeTime } from '../ui/RelativeTime'

// Air quality stations and satellite hotspots, as their publishers give them.

/** A station's values for the hour, each averaged over its own period, with the department's own index and rating. */
export function AirBody({ s, now }: { s: AirStation; now: number }) {
  const worst = worstRating(s)
  return (
    <>
      <Header icon={WindIcon} color={AIR_COLOR[worst ?? 0]} title={s.name} subtitle={`Air quality station · ${s.region}`} />
      <div className="grid gap-1 rounded-lg bg-kumo-recessed p-3">
        <Text size="sm" variant="secondary">
          Values as of {when.format(s.measuredAt)} AEST · <RelativeTime at={s.measuredAt} now={now} inline />
        </Text>
        <span className={`text-lg font-semibold ${worst ? AIR_TEXT[worst] : ''}`}>
          {worst ? AIR_RATINGS[worst - 1] : 'No rated reading'}
        </span>
        <Text size="xs" variant="secondary">
          The worst rating among this hour's values, as the department rates each one. Particles are averaged over 24 hours, carbon monoxide and ozone over 8, so they can lag behind the hour itself.
        </Text>
      </div>
      <Section title="Values">
        <dl className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1.5 text-sm">
          {s.measurements.map((m) => (
            <Fragment key={m.name}>
              <dt>
                {m.name}
                {m.averaging && <span className="block text-xs text-kumo-subtle">{m.averaging}</span>}
              </dt>
              <dd className="text-right tabular-nums">{m.value != null ? `${m.value} ${m.units ?? ''}`.trim() : m.gap === 'offline' ? 'Offline' : 'No data'}</dd>
              <dd className={`text-right font-medium ${m.rating ? AIR_TEXT[m.rating] : ''}`}>
                {m.ratingName ?? '–'}
              </dd>
            </Fragment>
          ))}
        </dl>
      </Section>
      <Section title="History">
        <AirHistory stationId={s.id} now={now} />
      </Section>
      <div className="grid gap-1">
        <ExternalLink href={s.link}>This station on the department's site</ExternalLink>
        <ExternalLink href={AIR_QUALITY_DATASET}>Air Quality Monitoring live data feed (open data)</ExternalLink>
        <Text size="xs" variant="secondary">
          Values, indexes and ratings as published by the Department of Environment, Tourism, Science and Innovation (CC BY 4.0). Units from its Air Quality Query API.
        </Text>
      </div>
    </>
  )
}

/** One satellite detection, as Geoscience Australia publishes it, with what it can and can't tell. */
export function HotspotBody({ h, now }: { h: Hotspot; now: number }) {
  const rows: [string, ReactNode][] = [
    ['Observed', <>{when.format(h.observedAt)} AEST · <RelativeTime at={h.observedAt} now={now} inline /></>],
    ['Satellite', h.sensor ? `${h.satellite} (${h.sensor})` : h.satellite],
    ['Detection method', h.product || 'Not published'],
    ['Position accuracy', h.accuracy ?? 'Not published'],
    ['Confidence', h.confidence != null ? `${h.confidence} out of 100` : 'Not published'],
    ['Measured temperature', h.kelvin != null ? `${h.kelvin} K (${(h.kelvin - 273.15).toFixed(1)} °C)` : 'Not published'],
    ['Position', `${h.position[1].toFixed(4)}, ${h.position[0].toFixed(4)}`],
  ]
  return (
    <>
      <Header icon={FireSimpleIcon} color={HOTSPOT_COLOR} title="Satellite hotspot" subtitle={`Heat detected by ${h.satellite}`} />
      <div className="grid gap-1 rounded-lg bg-kumo-recessed p-3">
        <Text size="sm">Not a confirmed fire</Text>
        <Text size="xs" variant="secondary">
          A satellite sensor measured unusual heat here. It can be a bushfire, a planned burn or another heat source, and the same heat is often
          detected by several satellites and methods. For what is happening on the ground, follow the Queensland Fire Department's warnings.
        </Text>
      </div>
      <Section title="Detection">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <Fragment key={k}>
              <dt className="text-kumo-subtle">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </Fragment>
          ))}
        </dl>
      </Section>
      <div className="grid gap-1">
        <ExternalLink href={HOTSPOTS_PORTAL}>DEA Hotspots map</ExternalLink>
        <Text size="xs" variant="secondary">
          {HOTSPOTS_ATTRIBUTION}, from Digital Earth Australia Hotspots, CC BY 4.0. Values as published; the temperature in °C is converted from kelvin.
        </Text>
      </div>
    </>
  )
}
