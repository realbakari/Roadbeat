import { Badge, Banner, Text } from '@cloudflare/kumo'
import {
  BabyCarriageIcon,
  BicycleIcon,
  CalendarStarIcon,
  CarProfileIcon,
  DropIcon,
  KeyIcon,
  PersonIcon,
  PersonSimpleWalkIcon,
  ShowerIcon,
  ToiletIcon,
  WarningIcon,
  WheelchairIcon,
  WrenchIcon,
  type Icon,
} from '@phosphor-icons/react'
import { Fragment, type ReactNode } from 'react'
import { BIKE_RACKS_URL, type BikeStop, type Toilet } from '../../api/bccPlaces'
import { EVENTS_URL, type CouncilEvent } from '../../api/bccDashboard'
import { formatDateTime } from '../../lib/format'
import { LAYER_COLOR } from '../../lib/mapIcons'
import { Header } from '../PlaceParts'
import { ExternalLink } from '../ui/Links'
import { Section } from '../ui/Section'
import { Directions } from './Directions'

// Brisbane City Council's public toilets, bike racks and events.

const TOILET_FEATURES: [keyof Toilet, string, Icon][] = [
  ['accessible', 'Accessible toilet', WheelchairIcon],
  ['ambulant', 'Ambulant toilet (grab rails)', PersonSimpleWalkIcon],
  ['changingPlaces', 'Changing Places (hoist and adult change table)', PersonIcon],
  ['adultChange', 'Adult change facilities', PersonIcon],
  ['mlak', 'Opens with an MLAK key', KeyIcon],
  ['keyRequired', 'Key needed', KeyIcon],
  ['accessibleParking', 'Accessible parking', CarProfileIcon],
  ['babyChange', 'Baby change', BabyCarriageIcon],
  ['drinkingWater', 'Drinking water', DropIcon],
  ['shower', 'Shower', ShowerIcon],
]

export function ToiletBody({ t }: { t: Toilet }) {
  const has = TOILET_FEATURES.filter(([k]) => t[k] === true)
  return (
    <>
      <Header icon={ToiletIcon} color={t.accessible ? LAYER_COLOR.toiletAccessible : LAYER_COLOR.toilet} title={t.name} subtitle={t.address ?? 'Public toilet'} />
      {t.hours && (
        <Section title="Opening hours">
          <Text size="sm">{t.hours.replace(/^OPEN:\s*/i, '')}</Text>
        </Section>
      )}
      <Section title="Facilities">
        {has.length ? (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {has.map(([k, label, I]) => (
              <li key={k} className="flex items-start gap-2 text-sm">
                <span className="flex h-lh items-center text-kumo-subtle">
                  <I size={16} aria-hidden />
                </span>
                {label}
              </li>
            ))}
          </ul>
        ) : (
          <Text size="sm" variant="secondary">
            No facilities listed.
          </Text>
        )}
        {!t.accessible && (
          <Text size="sm" variant="secondary">
            No accessible toilet is listed here.
          </Text>
        )}
      </Section>
      {t.notes.length > 0 && (
        <Section title="Notes">
          {t.notes.map((n) => (
            <Text key={n} size="sm">
              {n}
            </Text>
          ))}
        </Section>
      )}
      <div className="grid gap-1">
        {t.url && <ExternalLink href={t.url}>This toilet on the National Public Toilet Map</ExternalLink>}
        <Text size="xs" variant="secondary">
          National Public Toilet Map, published by Brisbane City Council (CC BY 4.0).
        </Text>
      </div>
      <Directions at={t.position} />
    </>
  )
}

export function BikeBody({ b }: { b: BikeStop }) {
  const repair = b.kind === 'repair'
  return (
    <>
      <Header
        icon={repair ? WrenchIcon : BicycleIcon}
        color={repair ? LAYER_COLOR.bikeRepair : LAYER_COLOR.bikeRack}
        title={b.name}
        subtitle={[repair ? 'Bike repair station' : 'Bike rack', b.suburb].filter(Boolean).join(' · ')}
      />
      {b.detail && <Text size="sm">{b.detail}</Text>}
      {b.capacity != null && (
        <Text size="sm">
          Holds {b.capacity} {b.capacity === 1 ? 'bike' : 'bikes'}.
        </Text>
      )}
      <ExternalLink href={BIKE_RACKS_URL}>Bicycle racks — Brisbane City Council</ExternalLink>
      <Directions at={b.position} />
    </>
  )
}

export function EventBody({ e }: { e: CouncilEvent }) {
  const rows: [string, ReactNode][] = []
  if (e.cost) rows.push(['Cost', e.cost])
  const age = [e.age, ...e.ageRange].filter(Boolean).join(' · ')
  if (age) rows.push(['Age', age])
  if (e.bookings || e.bookingsRequired != null) rows.push(['Bookings', e.bookings ?? (e.bookingsRequired ? 'Bookings required.' : 'No bookings required.')])
  if (e.meetingPoint) rows.push(['Meeting point', e.meetingPoint])
  if (e.requirements) rows.push(['Bring', e.requirements])
  const where = [e.venue, e.address && e.address !== e.venue ? e.address : null, e.venueType].filter(Boolean)
  return (
    <>
      {e.image && <img src={e.image} alt={e.title} loading="lazy" className="-mb-2 aspect-[16/9] w-full rounded-lg bg-kumo-recessed object-cover" />}
      <Header icon={CalendarStarIcon} color={LAYER_COLOR.councilEvent} title={e.title} subtitle={['Brisbane City Council event', e.primaryType].filter(Boolean).join(' · ')} />
      {e.status && <Banner variant={/cancel/i.test(e.status) ? 'error' : 'alert'} size="sm" icon={<WarningIcon weight="fill" />} title={e.status} description="As marked by the council." />}
      <div className="grid gap-1 rounded-lg bg-kumo-recessed p-3">
        <Text size="sm" variant="secondary">
          When
        </Text>
        <span className="text-lg font-semibold">{e.when ?? formatDateTime(new Date(e.start).toISOString()) ?? 'Not published'}</span>
      </div>
      {where.length > 0 && (
        <Section title="Where">
          <div className="grid gap-0.5 text-sm">
            {where.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        </Section>
      )}
      {rows.length > 0 && (
        <Section title="Details">
          <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5 text-sm">
            {rows.map(([k, v]) => (
              <Fragment key={k}>
                <dt className="text-kumo-subtle">{k}</dt>
                <dd className="whitespace-pre-line">{v}</dd>
              </Fragment>
            ))}
          </dl>
        </Section>
      )}
      {e.description && (
        <Section title="About">
          <p className="text-sm whitespace-pre-line">{e.description}</p>
        </Section>
      )}
      {e.types.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {e.types.map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </div>
      )}
      <div className="grid gap-1">
        {e.url && <ExternalLink href={e.url}>This event on Brisbane City Council's website</ExternalLink>}
        <ExternalLink href={EVENTS_URL}>Brisbane City Council events (open data)</ExternalLink>
        <Text size="xs" variant="secondary">
          Details and image as published by Brisbane City Council (CC BY 4.0).
        </Text>
      </div>
      {e.position && <Directions at={e.position} />}
    </>
  )
}
