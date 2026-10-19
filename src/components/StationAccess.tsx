import { Banner, Text } from '@cloudflare/kumo'
import {
  ArrowSquareOutIcon,
  ArticleIcon,
  BabyCarriageIcon,
  BicycleIcon,
  BusIcon,
  CarIcon,
  CaretDownIcon,
  CarProfileIcon,
  CheckIcon,
  ClockIcon,
  DoorIcon,
  DropIcon,
  EarIcon,
  ElevatorIcon,
  FootprintsIcon,
  HandshakeIcon,
  HeadsetIcon,
  InfoIcon,
  LockIcon,
  MapTrifoldIcon,
  PawPrintIcon,
  PersonIcon,
  PhoneIcon,
  SpeakerHighIcon,
  StepsIcon,
  StorefrontIcon,
  TaxiIcon,
  TicketIcon,
  ToiletIcon,
  TrainIcon,
  WarningIcon,
  WheelchairIcon,
  WheelchairMotionIcon,
  ArmchairIcon,
  ArrowsHorizontalIcon,
  BoatIcon,
  HandPointingIcon,
  SecurityCameraIcon,
  type Icon,
} from '@phosphor-icons/react'
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { fetchStationFacilities, STATION_FACILITIES_URL, type Feature, type StationFacilities } from '../api/stationFacilities'
import type { TransitAlert } from '../api/translink'
import { AudioPlayer } from './AudioPlayer'
import { fetchFerryTerminal, FERRY_TERMINALS_URL, type FerryTerminal } from '../api/ferryTerminals'
import { BUS_STOPS_URL, fetchBusStopAudit, type BusStopAudit, type Rating } from '../api/bccBusStops'
import { formatDay } from '../lib/format'
import { LightMarkdown } from './LightMarkdown'
import { NewTabNote } from './NewTabNote'
import { ExternalLink, InlineLink } from './ui/Links'

const QR = 'https://www.queenslandrail.com.au'

/**
 * Lift and escalator outages Translink reports for a stop or its platforms. Shown
 * near the top of a stop page, because they decide whether someone can use it.
 */
export function AccessAlerts({ alerts }: { alerts: TransitAlert[] }) {
  if (!alerts.length) return null
  return (
    <div className="grid gap-2" role="region" aria-label="Lift and escalator outages">
      {alerts.map((a) => (
        <Banner
          key={a.id}
          variant="alert"
          size="sm"
          icon={<WarningIcon weight="fill" />}
          title={a.header}
          description={
            <span className="grid gap-1">
              {a.description && <span>{a.description}</span>}
              {a.url && (
                <ExternalLink href={a.url}>More from Translink</ExternalLink>
              )}
            </span>
          }
        />
      ))}
    </div>
  )
}

/**
 * Queensland Rail's access and facilities details for a station, from Brisbane
 * City Council's open data. Renders nothing for stops that aren't Queensland Rail
 * stations in the dataset.
 */
export function StationFacilitiesSection({ stopId }: { stopId: string }) {
  // A failed fetch shows nothing; the rest of the stop page doesn't depend on it.
  const [state, setState] = useState<{ id: string; data: StationFacilities | null } | null>(null)
  useEffect(() => {
    let live = true
    fetchStationFacilities(stopId).then(
      (data) => live && setState({ id: stopId, data }),
      () => live && setState({ id: stopId, data: null }),
    )
    return () => {
      live = false
    }
  }, [stopId])
  const f = state?.id === stopId ? state.data : null
  if (!f) return null

  return (
    <section id="stop-access" className="grid scroll-mt-4 gap-4" aria-labelledby="stop-access-title">
      <Text as="h3" variant="heading" id="stop-access-title">
        Access and facilities
      </Text>

      {f.notice && (
        <Banner variant="secondary" size="sm" icon={<InfoIcon weight="fill" />} title="Queensland Rail notice" description={<LightMarkdown text={f.notice} base={QR} />} />
      )}

      <div className="grid gap-2">
        <SubHeading icon={<WheelchairIcon size={16} />}>Accessibility</SubHeading>
        {f.accessZone && <Text size="sm">{f.accessZone}</Text>}
        {f.boarding && <LightMarkdown text={f.boarding} base={QR} />}
        {f.access.length > 0 && <FeatureList features={f.access} />}
      </div>

      {(f.other.length > 0 || f.bikeRacks > 0) && (
        <div className="grid gap-2">
          <SubHeading icon={<StorefrontIcon size={16} />}>Facilities</SubHeading>
          <FeatureList
            features={[
              ...f.other.map((x) => (x.key === 'carpark' && f.carBays ? { ...x, label: `Car park, ${f.carBays} spaces` } : x)),
              ...(f.bikeRacks > 0 ? [{ key: 'bike_rack', label: `${f.bikeRacks} bike racks` }] : []),
            ]}
          />
        </div>
      )}

      {f.audio && (
        <div className="grid gap-2">
          <SubHeading icon={<SpeakerHighIcon size={16} />}>Audio description</SubHeading>
          <AudioPlayer src={f.audio} label={`audio description of ${f.name} station`} />
        </div>
      )}

      <div className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
        {f.hours && (
          <Disclosure icon={<ClockIcon size={16} />} title="Staffed hours">
            <LightMarkdown text={f.hours} base={QR} />
          </Disclosure>
        )}
        {f.description && (
          <Disclosure icon={<ArticleIcon size={16} />} title="Station layout, described in words">
            <LightMarkdown text={f.description} base={QR} />
          </Disclosure>
        )}
        {f.guide && (
          <a href={f.guide} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-kumo-tint">
            <MapTrifoldIcon size={16} className="text-kumo-subtle" aria-hidden />
            <span className="flex-1">Queensland Rail station map (PDF)</span>
            <ArrowSquareOutIcon size={14} className="text-kumo-subtle" aria-hidden />
            <NewTabNote />
          </a>
        )}
      </div>

      <Text size="xs" variant="secondary">
        Queensland Rail station details, published by Brisbane City Council (
        <InlineLink href={STATION_FACILITIES_URL}>Railway station facilities</InlineLink>
        , CC BY 4.0). Lift outages come from Translink's real-time alerts.
      </Text>
    </section>
  )
}

/**
 * Brisbane City Council's access details for a CityCat or ferry terminal. Renders
 * nothing for stops that aren't one of the council's terminals.
 */
export function FerryTerminalSection({ stopId }: { stopId: string }) {
  // A failed fetch shows nothing; the rest of the stop page doesn't depend on it.
  const [state, setState] = useState<{ id: string; data: FerryTerminal | null } | null>(null)
  useEffect(() => {
    let live = true
    fetchFerryTerminal(stopId).then(
      (data) => live && setState({ id: stopId, data }),
      () => live && setState({ id: stopId, data: null }),
    )
    return () => {
      live = false
    }
  }, [stopId])
  const t = state?.id === stopId ? state.data : null
  if (!t) return null
  const inspected = formatDay(t.inspected)

  return (
    <section id="stop-access" className="grid scroll-mt-4 gap-4" aria-labelledby="terminal-access-title">
      <Text as="h3" variant="heading" id="terminal-access-title">
        Terminal access and facilities
      </Text>
      {t.status && t.status !== 'ACTIVE' && (
        <Banner variant="alert" size="sm" icon={<WarningIcon weight="fill" />} title={`Terminal status: ${t.status.toLowerCase()}`} description="As recorded by Brisbane City Council." />
      )}
      <div className="grid gap-2">
        <SubHeading icon={<WheelchairIcon size={16} />}>Accessibility</SubHeading>
        {t.accessSummary && <Text size="sm">{t.accessSummary}</Text>}
        {t.access.length > 0 ? (
          <FeatureList features={t.access} />
        ) : (
          <Text size="sm" variant="secondary">
            No access features are recorded for this terminal.
          </Text>
        )}
      </div>
      {(t.other.length > 0 || t.toiletNote) && (
        <div className="grid gap-2">
          <SubHeading icon={<BoatIcon size={16} />}>Facilities</SubHeading>
          {t.other.length > 0 && <FeatureList features={t.other} />}
          {t.toiletNote && <Text size="sm">{t.toiletNote}</Text>}
        </div>
      )}
      {t.ticketing && (
        <Text size="sm" variant="secondary">
          {t.ticketing}
        </Text>
      )}
      <Text size="xs" variant="secondary">
        Brisbane City Council (
        <InlineLink href={FERRY_TERMINALS_URL}>Ferry terminals</InlineLink>
        , CC BY 4.0){inspected && `, last inspected ${inspected}`}. Lift outages come from Translink's real-time alerts.
      </Text>
    </section>
  )
}

const RATING_COLOR: Record<Rating, string> = { Easy: 'text-kumo-success', Medium: 'text-kumo-warning', Hard: 'text-kumo-danger' }

/**
 * Brisbane City Council's audit of a bus stop: its type and the council's
 * boarding, gradient and cross-fall ratings. Renders nothing for stops outside
 * the council's area.
 */
export function BusStopSection({ stopId }: { stopId: string }) {
  // A failed fetch shows nothing; the rest of the stop page doesn't depend on it.
  const [state, setState] = useState<{ id: string; data: BusStopAudit | null } | null>(null)
  useEffect(() => {
    let live = true
    fetchBusStopAudit(stopId).then(
      (data) => live && setState({ id: stopId, data }),
      () => live && setState({ id: stopId, data: null }),
    )
    return () => {
      live = false
    }
  }, [stopId])
  const a = state?.id === stopId ? state.data : null
  if (!a) return null
  const audited = formatDay(a.audited)
  const ratings: [string, Rating | null, string][] = [
    ['Boarding point', a.boarding, 'How easy it is to board from the kerb'],
    ['Road gradient', a.gradient, 'The slope of the road along the stop'],
    ['Cross fall', a.crossFall, 'The slope of the footpath across the stop'],
  ]

  return (
    <section id="stop-access" className="grid scroll-mt-4 gap-3" aria-labelledby="bus-stop-access-title">
      <Text as="h3" variant="heading" id="bus-stop-access-title">
        Stop access
      </Text>
      <Text size="sm">
        {[a.type && `${a.type} stop`, a.street && a.crossStreet ? `${a.street} near ${a.crossStreet}` : a.street, a.suburb].filter(Boolean).join(' · ')}
      </Text>
      <dl className="grid grid-cols-[8.5rem_1fr] gap-x-4 gap-y-1.5 text-sm">
        {ratings.map(([label, value, meaning]) => (
          <Fragment key={label}>
            <dt className="text-kumo-subtle" title={meaning}>
              {label}
            </dt>
            <dd className={value ? `font-medium ${RATING_COLOR[value]}` : 'text-kumo-subtle'}>{value ?? 'Not rated'}</dd>
          </Fragment>
        ))}
        <dt className="text-kumo-subtle">Tactile indicators</dt>
        <dd className={a.tactile == null ? 'text-kumo-subtle' : ''}>{a.tactile == null ? 'Not recorded' : a.tactile ? 'Yes' : 'No'}</dd>
      </dl>
      <Text size="xs" variant="secondary">
        Ratings as recorded in Brisbane City Council's bus stop audit (
        <InlineLink href={BUS_STOPS_URL}>Brisbane bus stops</InlineLink>
        , CC BY 4.0){audited && `, last audited ${audited}`}. Easy, Medium and Hard are the council's own terms.
      </Text>
    </section>
  )
}

/** An icon for each facility key in the dataset. */
const ICONS: Record<string, Icon> = {
  lift: ElevatorIcon,
  escalator: StepsIcon,
  level_boarding_to_vehicle: TrainIcon,
  boarding_ramp_available: WheelchairIcon,
  assisted_boarding_point: HandshakeIcon,
  accessible_ramp: WheelchairMotionIcon,
  accessible_parking: CarIcon,
  accessible_kiss_n_ride: CarProfileIcon,
  accessible_toilet_lh: ToiletIcon,
  accessible_toilet_rh: ToiletIcon,
  accessible_adult_change_facilities: PersonIcon,
  hearing_loop_available: EarIcon,
  tactile_ground_surface_indicators_platform_edges: FootprintsIcon,
  help_phone: PhoneIcon,
  assistance_animal_relief_area: PawPrintIcon,
  carpark: CarIcon,
  kiss_n_ride: CarProfileIcon,
  taxi_bay: TaxiIcon,
  bus_interchange: BusIcon,
  bike_enclosure: LockIcon,
  secure_bike_storage: LockIcon,
  bike_rack: BicycleIcon,
  toilets: ToiletIcon,
  baby_change: BabyCarriageIcon,
  drinking_fountain: DropIcon,
  customer_service_window: HeadsetIcon,
  ticket_vending_machine: TicketIcon,
  fare_gates: DoorIcon,
  dda_compliant: WheelchairIcon,
  gangway_level_landing: ArrowsHorizontalIcon,
  braille_signage: HandPointingIcon,
  seating: ArmchairIcon,
  cctv: SecurityCameraIcon,
}

function FeatureList({ features }: { features: Feature[] }) {
  return (
    <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
      {features.map((x) => {
        const I = ICONS[x.key] ?? CheckIcon
        return (
          <li key={x.key} className="flex items-start gap-2 text-sm">
            <span className="flex h-lh items-center text-kumo-subtle">
              <I size={16} aria-hidden />
            </span>
            {x.label}
          </li>
        )
      })}
    </ul>
  )
}

function SubHeading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h4 className="flex items-center gap-2 text-sm font-medium text-kumo-strong">
      <span className="text-kumo-subtle" aria-hidden>
        {icon}
      </span>
      {children}
    </h4>
  )
}

function Disclosure({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-kumo-tint [&::-webkit-details-marker]:hidden">
        <span className="text-kumo-subtle" aria-hidden>
          {icon}
        </span>
        <span className="flex-1">{title}</span>
        <CaretDownIcon size={14} className="text-kumo-subtle transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="px-3 pt-1 pb-3">{children}</div>
    </details>
  )
}
