import { Badge, Banner, Button, Text } from '@cloudflare/kumo'
import {
  ArrowLeftIcon,
  BellIcon,
  BellRingingIcon,
  ClockCounterClockwiseIcon,
  ProhibitIcon,
  SirenIcon,
  WarningIcon,
  WavesIcon,
} from '@phosphor-icons/react'
import { useMemo } from 'react'
import type { Camera, TrafficEvent } from '../api/types'
import { FLOOD_ADVICE, priorityBadge, typeMeta } from '../lib/eventMeta'
import { clean, formatDateTime, titleCase } from '../lib/format'
import { isClosure } from '../lib/filters'
import { startLabel } from '../lib/eventStatus'
import { distanceKm, eventAnchor } from '../lib/geo'
import { CameraThumb } from './CameraGrid'
import type { Gauge } from '../api/bccGauges'
import { CrashNearby } from './CrashNearby'
import { GaugesNearby } from './GaugesNearby'
import { RoadContacts } from './RoadContacts'
import { TypeIcon } from './EventCard'
import { eventTitle } from '../lib/eventText'
import { updateGap, updateGapText } from '../lib/eventAge'
import { shareUrl } from '../lib/sharePage'
import { ShareButton } from './ui/ShareButton'
import { ReportChange } from './ReportChange'
import { eventShareText } from '../lib/shareText'
import { ExternalLink, InlineLink, linkClass } from './ui/Links'
import { Section } from './ui/Section'
import { Facts } from './ui/Facts'
import { RelativeTime } from './ui/RelativeTime'
import { EventPlace } from './EventPlace'
import { useLocalityIndex } from '../hooks/useLocality'

interface Props {
  event: TrafficEvent
  cameras: Camera[]
  now: number
  onBack: () => void
  onOpenCamera: (key: string) => void
  watched: boolean
  onToggleWatch: () => void
  /** Brisbane City Council and Queensland Government gauges, shown next to flooding events. */
  gauges: Gauge[] | null
  /** Why gauges are missing or stale, or null while the feeds are fine. */
  gaugeNotice?: string | null
  onOpenHref: (hash: string) => void
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function EventDetail({ event, cameras, now, onBack, onOpenCamera, watched, onToggleWatch, gauges, gaugeNotice, onOpenHref }: Props) {
  const p = event.properties
  const meta = typeMeta(p.event_type)
  const pr = priorityBadge(p.event_priority)
  const impact = p.impact
  const r = p.road_summary
  const d = p.duration

  const anchor = useMemo(() => eventAnchor(event), [event])
  const nearby = useMemo(() => {
    const a = anchor
    if (!a) return []
    return cameras
      .map((c) => ({ c, km: distanceKm(a, c.geometry.coordinates as [number, number]) }))
      .filter((x) => x.km <= 15)
      .sort((x, y) => x.km - y.km)
      .slice(0, 4)
  }, [anchor, cameras])

  const gap = updateGap(event, now)
  // Brisbane time, labelled as every other detail page labels it.
  const aest = (iso: string | null | undefined) => {
    const t = formatDateTime(iso)
    return t ? `${t} AEST` : null
  }
  const localities = useLocalityIndex()
  const direction = [clean(impact?.direction), clean(impact?.towards) && `towards ${clean(impact?.towards)}`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-kumo-line px-2 py-2">
        <Button variant="ghost" size="sm" icon={<ArrowLeftIcon />} onClick={onBack}>
          All events
        </Button>
        <div className="flex items-center gap-1">
        <Button
          variant={watched ? 'secondary' : 'ghost'}
          size="sm"
          icon={watched ? <BellRingingIcon weight="fill" /> : <BellIcon />}
          onClick={onToggleWatch}
          title={watched ? 'Stop alerts for this event' : 'Get alerts when this event changes or clears'}
        >
          {watched ? 'Watching' : 'Watch'}
        </Button>
        <ShareButton title={eventTitle(event)} text={eventShareText(event)} url={shareUrl(location.origin, `#event/${p.id}`) ?? location.href} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-6 px-4 pt-4 pb-8">
          <header className="grid gap-3">
            <div className="flex items-start gap-3">
              <TypeIcon type={p.event_type} size="lg" />
              <div className="grid min-w-0 gap-0.5">
                <Text as="h2" variant="heading" size="lg">
                  {eventTitle(event)}
                </Text>
                <Text variant="secondary">
                  <EventPlace event={event} index={localities} onOpenHref={onOpenHref} />
                </Text>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={meta.badge}>
                {[p.event_type, clean(p.event_subtype), clean(p.event_due_to)].filter(Boolean).join(' · ')}
              </Badge>
              <Badge variant={pr.variant} appearance={pr.appearance}>
                {p.event_priority} priority
              </Badge>
              {p.status === 'Reopened' && <Badge variant="success">Reopened</Badge>}
            </div>
          </header>

          {isClosure(event) && (
            <Banner
              variant="error"
              icon={<ProhibitIcon weight="fill" />}
              title={clean(impact?.impact_subtype) ?? 'Road closed'}
              description={direction || undefined}
            />
          )}
          {p.event_type === 'Flooding' && (
            <Banner
              variant="alert"
              icon={<WavesIcon weight="bold" />}
              title={FLOOD_ADVICE.title}
              description={
                <>
                  “{FLOOD_ADVICE.text}” <InlineLink href={FLOOD_ADVICE.url}>Queensland Government</InlineLink>
                </>
              }
            />
          )}
          {gap && (
            <Banner
              variant="secondary"
              icon={<ClockCounterClockwiseIcon weight="bold" />}
              title={updateGapText(gap)}
              description="QLDTraffic still lists it, so Roadbeat shows it as published. Before you rely on it, check with Transport and Main Roads on 13 19 40."
            />
          )}
          {p.area_alert && clean(p.alert_message) && (
            <Banner variant="alert" icon={<SirenIcon weight="fill" />} title="Area alert" description={clean(p.alert_message)!} />
          )}

          {clean(p.description) && <Text>{clean(p.description)}</Text>}

          {clean(p.advice) && (
            <Banner
              variant="alert"
              icon={<WarningIcon weight="fill" />}
              title="Advice"
              description={clean(p.advice)!}
            />
          )}

          <Section title="Impact">
            <Facts
              labelWidth="wide"
              rows={[
                ['Effect', [clean(impact?.impact_type), clean(impact?.impact_subtype)].filter(Boolean).join(' · ')],
                ['Direction', direction],
                ['Delay', clean(impact?.delay)],
              ]}
            />
            <a href="/glossary/#road-closures-and-restrictions" className={`mt-2 inline-block text-sm ${linkClass}`}>
              What these terms mean
            </a>
          </Section>

          <Section title="When">
            <Facts
              labelWidth="wide"
              rows={[
                [startLabel(d?.start, now), aest(d?.start)],
                ['Expected end', aest(d?.end) ?? 'Until further notice'],
                ['Next inspection', aest(p.next_inspection)],
              ]}
            />
            {!!d?.active_days?.length && (
              <div className="mt-3 flex gap-1" aria-label="Active days">
                {DAYS.map((day) => {
                  const on = d.active_days!.includes(day)
                  return (
                    <span
                      key={day}
                      title={day}
                      className={`flex h-7 flex-1 items-center justify-center rounded-md text-xs ${
                        on ? 'bg-kumo-contrast text-kumo-inverse' : 'bg-kumo-recessed text-kumo-subtle'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </span>
                  )
                })}
              </div>
            )}
            {!!d?.recurrences?.length && (
              <ul className="mt-3 grid gap-2">
                {d.recurrences.map((rec, i) => (
                  <li key={i} className="rounded-lg bg-kumo-recessed px-3 py-2">
                    <Text bold size="sm">
                      {rec.description}
                    </Text>
                    {rec.impact && (
                      <Text variant="secondary" size="sm">
                        {[clean(rec.impact.impact_subtype), clean(rec.impact.delay)].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <ReportChange about="road" managersId={anchor ? 'who-manages' : undefined} />

          <Section title="Location">
            <Facts
              labelWidth="wide"
              rows={[
                ['Road', clean(r?.road_name)],
                ['Locality', [clean(r?.locality), clean(r?.postcode)].filter(Boolean).join(' ')],
                ['Council', titleCase(r?.local_government_area)],
                ['District', clean(r?.district)],
              ]}
            />
          </Section>

          {nearby.length > 0 && (
            <Section title="Nearby cameras">
              <div className="grid grid-cols-2 gap-2">
                {nearby.map(({ c, km }) => (
                  <CameraThumb key={`${c.kind}-${c.properties.id}`} camera={c} note={`${km.toFixed(1)} km`} onOpen={onOpenCamera} />
                ))}
              </div>
            </Section>
          )}

          {anchor && p.event_type === 'Flooding' && (gauges?.some((g) => distanceKm(anchor, g.position) <= 5) || gaugeNotice) && (
            <Section title="Stream gauges nearby">
              {gaugeNotice && (
                <Text size="sm" variant="error">
                  {gaugeNotice}
                </Text>
              )}
              {gauges?.some((g) => distanceKm(anchor, g.position) <= 5) && <GaugesNearby at={anchor} gauges={gauges} now={now} onOpen={onOpenHref} />}
            </Section>
          )}

          {anchor && (
            <Section title="Crash history nearby">
              <CrashNearby at={anchor} />
            </Section>
          )}

          {anchor && (
            <Section id="who-manages" title="Who manages this road">
              <RoadContacts at={anchor} />
            </Section>
          )}

          {clean(p.information) && (
            <Section title="More information">
              <Text>{clean(p.information)}</Text>
            </Section>
          )}

          <div className="grid gap-1 border-t border-kumo-line pt-4">
            <Text variant="secondary" size="sm">
              Updated <RelativeTime at={p.last_updated} now={now} /> · Event #{p.id}
              {clean(p.source?.provided_by) && ` · ${clean(p.source?.provided_by)}`}
            </Text>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {clean(p.web_link) && <ExternalLink href={clean(p.web_link)!}>More details</ExternalLink>}
              {clean(p.source?.provided_by_url)?.startsWith('http') && (
                <ExternalLink href={clean(p.source?.provided_by_url)!}>{clean(p.source?.provided_by) ?? 'Data provider'}</ExternalLink>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
