import { Button, Text } from '@cloudflare/kumo'
import { HouseLineIcon, LightningIcon, MapPinIcon, PackageIcon } from '@phosphor-icons/react'
import { Fragment, type ReactNode } from 'react'
import type { CouncilCentre, Outage } from '../../api/newsTypes'
import { brisbaneDayDateTime as when } from '../../lib/aest'
import { CENTRE_COLOR, centreKind } from '../../lib/councilCentres'
import { timeAgo } from '../../lib/format'
import { isUnplaced, OUTAGE_COLOR } from '../../lib/outages'
import { ClampedText } from '../ClampedText'
import { Header } from '../PlaceParts'
import { ExternalLink } from '../ui/Links'
import { Section } from '../ui/Section'

// What the council disaster dashboards list: centres, power outages and notices.

const CENTRE_ICON = { shelter: HouseLineIcon, sandbag: PackageIcon, other: MapPinIcon } as const

/** A centre exactly as its council lists it on its disaster dashboard. */
export function CentreBody({ c }: { c: CouncilCentre }) {
  const kind = centreKind(c.type)
  return (
    <>
      <Header icon={CENTRE_ICON[kind]} color={CENTRE_COLOR[kind]} title={c.name} subtitle={`${c.type} · ${c.council}`} />
      <div className="grid gap-1 rounded-lg bg-kumo-recessed p-3">
        <Text size="sm" variant="secondary">
          Status
        </Text>
        <span className="text-lg font-semibold">{c.status ?? 'Not given'}</span>
        <Text size="xs" variant="secondary">
          As the council lists it. Check the council's dashboard before you travel.
        </Text>
      </div>
      {c.address && (
        <Section title="Address">
          <p className="text-sm">{c.address}</p>
        </Section>
      )}
      {c.note && (
        <Section title="Council note">
          <ClampedText className="text-sm whitespace-pre-line" lines={3} text={c.note} />
        </Section>
      )}
      <ExternalLink href={c.dashboard}>{c.council} disaster dashboard</ExternalLink>
    </>
  )
}

/** An Energex outage or a council notice, as the council's dashboard relays it. */
export function OutageBody({ o, now, onOpenHref }: { o: Outage; now: number; onOpenHref?: (href: string) => void }) {
  const energex = o.source === 'energex'
  const suburb = o.place?.name
  const rows: [string, ReactNode][] = []
  if (o.status) rows.push(['Status', o.status])
  if (o.customers != null) rows.push(['Customers affected', o.customers.toLocaleString('en-AU')])
  if (o.start) rows.push(['From', when.format(o.start)])
  if (o.end) rows.push([energex ? 'Estimated restore' : 'Until', when.format(o.end)])
  if (o.streets.length) rows.push(['Streets', o.streets.join(', ')])
  if (o.updated) rows.push(['Updated', `${when.format(o.updated)} · ${timeAgo(o.updated, now)}`])
  return (
    <>
      <Header icon={LightningIcon} color={OUTAGE_COLOR[o.source]} title={o.title} subtitle={energex ? `${o.type} outage · reported by Energex` : `${o.type} · ${o.council} notice`} />
      {o.details && (
        <Section title="Details">
          <ClampedText className="text-sm whitespace-pre-line" lines={3} text={o.details} />
        </Section>
      )}
      {rows.length > 0 && (
        <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <Fragment key={k}>
              <dt className="text-kumo-subtle">{k}</dt>
              <dd>{v}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      <Section title="On the map">
        <Text size="sm" variant="secondary">
          {o.place
            ? `Located from: ${o.place.name}. Energex names the suburb and streets, not a point, so the marker is at the suburb's gazetteer point.`
            : isUnplaced(o)
              ? `Not on the map. Energex names the suburb and streets, not a point, and the place names gazetteer has no suburb by this name in ${o.council}, so Roadbeat has nowhere to put it.`
              : `At the shape ${o.council} published.`}
        </Text>
        {suburb && onOpenHref && (
          <Button size="xs" variant="ghost" className="w-fit" icon={<MapPinIcon />} onClick={() => onOpenHref(`place/locality/${encodeURIComponent(suburb)}`)}>
            More at {suburb}
          </Button>
        )}
      </Section>
      <div className="grid gap-1">
        <ExternalLink href={o.dashboard}>{o.council.replace(/ Council$/, '')} disaster dashboard</ExternalLink>
        {energex && <ExternalLink href="https://www.energex.com.au/home/power-outages/outage-finder">Energex outage finder</ExternalLink>}
      </div>
    </>
  )
}
