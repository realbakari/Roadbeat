import { Badge, Banner, Button, Text } from '@cloudflare/kumo'
import {
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  ArrowsVerticalIcon,
  CoffeeIcon,
  DropIcon,
  MapPinIcon,
  ToiletIcon,
  TruckIcon,
  VanIcon,
  WarningIcon,
  WheelchairIcon,
  CarProfileIcon,
  BabyCarriageIcon,
  KeyIcon,
  PersonIcon,
  PersonSimpleWalkIcon,
  ProhibitIcon,
  ShowerIcon,
  LetterCirclePIcon,
  BicycleIcon,
  WrenchIcon,
  CalendarStarIcon,
  HouseLineIcon,
  LightningIcon,
  WindIcon,
  PackageIcon,
  type Icon,
} from '@phosphor-icons/react'
import { Fragment, type ReactNode } from 'react'
import { BCC_CLEARANCES_URL, clearanceLabel, QR_BRIDGES_URL, QR_CLEARANCES_URL, type Clearance } from '../api/clearances'
import { ACCESSIBLE_PARKING_URL, BIKE_RACKS_URL, CLEARWAYS_URL, PARKING_METERS_URL, type AccessibleBay, type BikeStop, type Clearway, type ParkingMeter, type Toilet } from '../api/bccPlaces'
import { EVENTS_URL, type CouncilEvent } from '../api/bccDashboard'
import type { CouncilCentre, Outage } from '../api/newsTypes'
import { OUTAGE_COLOR } from '../lib/outages'
import { ClampedText } from './ClampedText'
import { AIR_COLOR, AIR_QUALITY_DATASET, AIR_RATINGS, worstRating, type AirStation } from '../api/airQuality'
import { CENTRE_COLOR, centreKind } from '../lib/councilCentres'
import { clearwayInEffect, parseClearwayTimes } from '../lib/clearways'
import { formatDateTime, formatDay, stripHtml, timeAgo, titleCase } from '../lib/format'
import { LAYER_COLOR } from '../lib/mapIcons'
import type { Place } from '../lib/places'
import { NewTabNote } from './NewTabNote'

// Codes used by the QLD_RA_LITE feed, labelled as on qldtraffic.qld.gov.au.
const REST_TYPES: Record<string, string> = {
  RA: 'Motorist rest area with facilities',
  SS: 'Scenic stop',
  DR: 'Driver Reviver',
  'RA DR': 'Motorist rest area and Driver Reviver',
  'RA HV': 'Motorist and heavy vehicle rest area (shared) with facilities',
  HV: 'Heavy vehicle rest area with facilities',
  HVSP: 'Heavy vehicle stopping place',
  SC: 'Service centre',
  'SC HV': 'Service centre with heavy vehicle facilities',
  MSB: 'Motorist stopping bay',
  HVSB: 'Heavy vehicle stopping bay',
  MHSB: 'Motorist and heavy vehicle stopping bay',
}

interface Props {
  place: Place
  now: number
  onBack: () => void
  /** Opens another app page from a link, such as an outage's suburb page. */
  onOpenHref?: (href: string) => void
}

export function PlaceDetail({ place, now, onBack, onOpenHref }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center border-b border-kumo-line px-2 py-2">
        <Button variant="ghost" size="sm" icon={<ArrowLeftIcon />} onClick={onBack}>
          Back
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-6 px-4 pt-4 pb-8">{body(place, now, onOpenHref)}</div>
      </div>
    </div>
  )
}

function body(place: Place, now: number, onOpenHref?: (href: string) => void) {
  switch (place.kind) {
    case 'rest': {
      const r = place.data
      return (
        <>
          <Header
            icon={r.heavyVehicle ? TruckIcon : CoffeeIcon}
            color={r.heavyVehicle ? LAYER_COLOR.hvRestArea : LAYER_COLOR.restArea}
            title={r.name ?? 'Rest area'}
            subtitle={REST_TYPES[r.type] ?? 'Rest area'}
          />
          <Section title="Facilities">
            <div className="flex flex-wrap gap-1.5">
              <Amenity on={r.toilet} icon={ToiletIcon}>
                Toilets
              </Amenity>
              <Amenity on={r.accessibleToilet} icon={WheelchairIcon}>
                Accessible toilet
              </Amenity>
              <Amenity on={!!r.water} icon={DropIcon}>
                {r.water ? `Water: ${r.water.toLowerCase()}` : 'No water'}
              </Amenity>
              <Amenity on={r.carBays} icon={CarProfileIcon}>
                Car parking
              </Amenity>
              <Amenity on={!!r.truckBays} icon={TruckIcon}>
                {r.truckBays ? `Truck bays: ${r.truckBays}` : 'No truck bays'}
              </Amenity>
            </div>
          </Section>
          <Directions at={r.coordinates} />
        </>
      )
    }
    case 'dump': {
      const d = place.data
      return (
        <>
          <Header icon={VanIcon} color={LAYER_COLOR.dumpPoint} title={d.name} subtitle="RV effluent dump point" />
          <Text>{d.description}</Text>
          <Directions at={d.coordinates} />
        </>
      )
    }
    case 'truck': {
      const t = place.data.properties
      return (
        <>
          <Header
            icon={TruckIcon}
            color={LAYER_COLOR.truck}
            title={t.name}
            subtitle={`${t.originterm} to ${t.destinationterm}`}
          />
          <Banner
            variant="error"
            icon={<WarningIcon weight="fill" />}
            title="Heavy vehicle access restricted"
            description={stripHtml(t.description).replace(/\n+/g, ' ')}
          />
          <Section title="Roads">
            <Text>{t.roads}</Text>
          </Section>
          <Section title="Suburbs">
            <Text>{t.suburbs}</Text>
          </Section>
          {t.moreinformation && <ExternalLink href={t.moreinformation}>More information</ExternalLink>}
        </>
      )
    }
    case 'waze': {
      const w = place.data
      const where = [w.street, w.city].filter(Boolean).join(', ')
      return (
        <>
          <Header
            icon={CarProfileIcon}
            color={LAYER_COLOR.waze}
            title={w.subtype === 'ACCIDENT_MINOR' ? 'Minor crash reported' : 'Crash reported'}
            subtitle={where || 'Location reported by Waze users'}
          />
          <Banner
            variant="secondary"
            title="Unverified driver report"
            description="Waze users reported this. TMR hasn't confirmed it, so treat it as a heads-up."
          />
          <Section title="Report">
            <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-kumo-subtle">Reported</dt>
              <dd>{timeAgo(w.pubMillis, now)}</dd>
              <dt className="text-kumo-subtle">Reliability</dt>
              <dd>{w.reliability}/10</dd>
              <dt className="text-kumo-subtle">Confirmations</dt>
              <dd>{w.nThumbsUp}</dd>
            </dl>
          </Section>
          <Directions at={[w.location.x, w.location.y]} />
        </>
      )
    }
    case 'clearance':
      return <ClearanceBody c={place.data} />
    case 'clearway':
      return <ClearwayBody c={place.data} now={now} />
    case 'toilet':
      return <ToiletBody t={place.data} />
    case 'bay':
      return <BayBody b={place.data} />
    case 'meter':
      return <MeterBody m={place.data} />
    case 'bike':
      return <BikeBody b={place.data} />
    case 'event':
      return <EventBody e={place.data} />
    case 'centre':
      return <CentreBody c={place.data} />
    case 'outage':
      return <OutageBody o={place.data} now={now} onOpenHref={onOpenHref} />
    case 'air':
      return <AirBody s={place.data} now={now} />
  }
}

function ClearwayBody({ c, now }: { c: Clearway; now: number }) {
  const on = clearwayInEffect(parseClearwayTimes(c.times), now)
  const p = c.geometry.type === 'LineString' ? c.geometry.coordinates[0] : c.geometry.coordinates[0][0]
  return (
    <>
      <Header icon={ProhibitIcon} color={on ? LAYER_COLOR.clearwayOn : LAYER_COLOR.clearwayOff} title="Clearway" subtitle="Brisbane City Council" />
      <div className="grid gap-1 rounded-lg bg-kumo-recessed p-3">
        <Text size="sm" variant="secondary">
          Signed times
        </Text>
        <span className="text-xl font-semibold">{c.times ?? 'Not published'}</span>
        <span className={`text-sm font-medium ${on ? 'text-kumo-danger' : 'text-kumo-subtle'}`}>
          {on == null ? "Roadbeat couldn't read these times, so it doesn't say whether the clearway is in effect." : on ? 'In effect now: no stopping or parking' : 'Not in effect right now'}
        </span>
      </div>
      <Text size="sm" variant="secondary">
        Vehicles stopped in a clearway while it's in effect can be towed. The times above are the council's record of the signs; the signs on the road
        are what count, including public holiday and event changes.
      </Text>
      <ExternalLink href={CLEARWAYS_URL}>Parking — clearways — Brisbane City Council</ExternalLink>
      <Directions at={[p[0], p[1]]} />
    </>
  )
}

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

function ToiletBody({ t }: { t: Toilet }) {
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

const dollars = (n: number) => `$${n.toFixed(2)}`

function MeterBody({ m }: { m: ParkingMeter }) {
  const rows: [string, ReactNode][] = []
  if (m.days || m.hours) rows.push(['Paid hours', [m.days, m.hours].filter(Boolean).join(', ')])
  if (m.maxStayHours != null) rows.push(['Maximum stay', `${m.maxStayHours} ${m.maxStayHours === 1 ? 'hour' : 'hours'}`])
  if (m.rate != null) rows.push(['Rate', `${dollars(m.rate)} an hour`])
  if (m.afterHoursRate != null) rows.push(['After hours and weekends', `${dollars(m.afterHoursRate)} an hour`])
  if (m.cap != null) rows.push(['Most a stay costs', dollars(m.cap)])
  if (m.zone) rows.push(['Tariff zone', m.zone])
  if (m.bays != null) rows.push(['Bays', String(m.bays)])
  if (m.payment) rows.push(['How to pay', m.payment])
  if (m.appZone) rows.push(['Parking app zone', m.appZone])
  return (
    <>
      <Header icon={LetterCirclePIcon} color={LAYER_COLOR.parkingMeter} title={m.street ?? 'Parking meter'} subtitle={['Parking meter', m.suburb].filter(Boolean).join(' · ')} />
      {m.where && <Text size="sm">{m.where}</Text>}
      {m.restriction && (
        <Banner variant="alert" size="sm" icon={<WarningIcon weight="fill" />} title="Also signed here" description={m.restriction} />
      )}
      <Section title="Hours and rates">
        <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <Fragment key={k}>
              <dt className="text-kumo-subtle">{k}</dt>
              <dd>{v}</dd>
            </Fragment>
          ))}
        </dl>
      </Section>
      <Text size="sm" variant="secondary">
        As listed by the council. The signs and the meter on the street are what count.
      </Text>
      <ExternalLink href={PARKING_METERS_URL}>Parking meters — Brisbane City Council</ExternalLink>
      <Directions at={m.position} />
    </>
  )
}

const CENTRE_ICON = { shelter: HouseLineIcon, sandbag: PackageIcon, other: MapPinIcon } as const

/** A centre exactly as its council lists it on its disaster dashboard. */
function CentreBody({ c }: { c: CouncilCentre }) {
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

const when = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** A station's readings for the hour, each with the department's own index and rating. */
function AirBody({ s, now }: { s: AirStation; now: number }) {
  const worst = worstRating(s)
  return (
    <>
      <Header icon={WindIcon} color={AIR_COLOR[worst ?? 0]} title={s.name} subtitle={`Air quality station · ${s.region}`} />
      <div className="grid gap-1 rounded-lg bg-kumo-recessed p-3">
        <Text size="sm" variant="secondary">
          Readings for {when.format(s.measuredAt)} · {timeAgo(s.measuredAt, now)}
        </Text>
        <span className="text-lg font-semibold" style={{ color: worst ? AIR_COLOR[worst] : undefined }}>
          {worst ? AIR_RATINGS[worst - 1] : 'No rated reading'}
        </span>
        <Text size="xs" variant="secondary">
          The worst rating among this hour's readings, as the department rates each one.
        </Text>
      </div>
      <Section title="Readings">
        <dl className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1.5 text-sm">
          {s.measurements.map((m) => (
            <Fragment key={m.name}>
              <dt>{m.name}</dt>
              <dd className="text-right tabular-nums">{m.value != null ? `${m.value} ${m.units ?? ''}`.trim() : m.gap === 'offline' ? 'Offline' : 'No data'}</dd>
              <dd className="text-right font-medium" style={{ color: m.rating ? AIR_COLOR[m.rating] : undefined }}>
                {m.ratingName ?? '–'}
              </dd>
            </Fragment>
          ))}
        </dl>
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

/** An Energex outage or a council notice, as the council's dashboard relays it. */
function OutageBody({ o, now, onOpenHref }: { o: Outage; now: number; onOpenHref?: (href: string) => void }) {
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

function EventBody({ e }: { e: CouncilEvent }) {
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

function BikeBody({ b }: { b: BikeStop }) {
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

function BayBody({ b }: { b: AccessibleBay }) {
  return (
    <>
      <Header icon={WheelchairIcon} color={LAYER_COLOR.accessibleParking} title={b.street ?? 'Accessible parking'} subtitle={['Accessible parking', b.suburb].filter(Boolean).join(' · ')} />
      <Section title="Signed days and times">
        {b.times.length ? (
          <ul className="grid gap-1 text-sm">
            {b.times.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : (
          <Text size="sm" variant="secondary">
            The council's record has no times for this sign. Check the sign on the street.
          </Text>
        )}
      </Section>
      <Text size="sm" variant="secondary">
        For vehicles displaying a disability parking permit. The position is the sign's, from the council's sign records.
      </Text>
      <ExternalLink href={ACCESSIBLE_PARKING_URL}>Disability permit parking — Brisbane City Council</ExternalLink>
      <Directions at={b.position} />
    </>
  )
}

// Owner codes the council's dataset uses.
const OWNERS: Record<string, string> = { BCC: 'Brisbane City Council', TMR: 'Transport and Main Roads' }
const owner = (s: string | null) => (s ? (OWNERS[s] ?? titleCase(s)) : null)

function ClearanceBody({ c }: { c: Clearance }) {
  const qr = c.source === 'qr'
  const dated = formatDay(c.dated)
  const rows: [string, ReactNode][] = []
  if (c.category) rows.push(['Category', c.category])
  if (c.owner) rows.push(['Structure owner', <Contact key="owner" name={owner(c.owner)} phone={c.ownerPhone} />])
  if (c.roadOwner) rows.push(['Road owner', <Contact key="road" name={owner(c.roadOwner)} phone={c.roadOwnerPhone} />])
  rows.push([qr ? 'Extract dated' : 'Validated', dated ?? 'Not published'])
  return (
    <>
      <Header
        icon={ArrowsVerticalIcon}
        color={LAYER_COLOR.clearance}
        ink="#111"
        title={c.title}
        subtitle={qr ? `Queensland Rail bridge${c.suburb ? `, ${c.suburb}` : ''}` : 'Brisbane City Council low clearance'}
      />
      <div className="grid gap-1 rounded-lg bg-kumo-recessed p-3">
        <Text size="sm" variant="secondary">
          Signed clearance
        </Text>
        <span className="text-3xl font-semibold tabular-nums">{clearanceLabel(c.metres)}</span>
        <Text size="sm" variant="secondary">
          The height on the sign, as {qr ? 'Queensland Rail' : 'the council'} published it. Clearances change with roadworks and not every low
          structure is listed, so always obey the signs on the road.
        </Text>
      </div>
      <Section title="Details">
        <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <Fragment key={k}>
              <dt className="text-kumo-subtle">{k}</dt>
              <dd>{v}</dd>
            </Fragment>
          ))}
        </dl>
      </Section>
      <div className="grid gap-1.5">
        <ExternalLink href={qr ? QR_CLEARANCES_URL : BCC_CLEARANCES_URL}>
          {qr ? 'Road height restrictions — Queensland Rail' : 'Road height restrictions — Brisbane City Council'}
        </ExternalLink>
        {qr && <ExternalLink href={QR_BRIDGES_URL}>Queensland Rail: rail bridges</ExternalLink>}
      </div>
      <Directions at={c.position} />
    </>
  )
}

function Contact({ name, phone }: { name: string | null; phone: string | null }) {
  return (
    <>
      {name}
      {phone && (
        <>
          {name && ' · '}
          <a href={`tel:${phone.replace(/\s+/g, '')}`} className="text-kumo-link underline decoration-1 underline-offset-2">
            {phone}
          </a>
        </>
      )}
    </>
  )
}

function Header({ icon: I, color, ink = '#fff', title, subtitle }: { icon: Icon; color: string; ink?: string; title: string; subtitle: string }) {
  return (
    <header className="flex items-start gap-3">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: color, color: ink }}
        aria-hidden
      >
        <I size={22} weight="fill" />
      </span>
      <div className="grid min-w-0 gap-0.5">
        <Text as="h2" variant="heading" size="lg">
          {title}
        </Text>
        <Text variant="secondary">{subtitle}</Text>
      </div>
    </header>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <Text as="h3" variant="heading">
        {title}
      </Text>
      <div>{children}</div>
    </section>
  )
}

function Amenity({ on, icon: I, children }: { on: boolean; icon: Icon; children: ReactNode }) {
  return (
    <Badge variant={on ? 'green' : 'outline'} icon={on ? <I weight="fill" /> : undefined}>
      <span className={on ? '' : 'text-kumo-subtle line-through'}>{children}</span>
    </Badge>
  )
}

function Directions({ at }: { at: [number, number] }) {
  const [lng, lat] = at
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-kumo-contrast px-3 text-sm text-kumo-inverse hover:opacity-90"
      >
        <MapPinIcon weight="fill" />
        Get directions
        <NewTabNote />
      </a>
      <span className="inline-flex items-center text-sm text-kumo-subtle tabular-nums">
        {lat.toFixed(4)}, {lng.toFixed(4)}
      </span>
    </div>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-kumo-link underline decoration-1 underline-offset-2">
      {children}
      <ArrowSquareOutIcon size={14} />
      <NewTabNote />
    </a>
  )
}
