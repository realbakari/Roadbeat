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
  type Icon,
} from '@phosphor-icons/react'
import { useEffect, useState, type ReactNode } from 'react'
import { fetchStationFacilities, STATION_FACILITIES_URL, type Feature, type StationFacilities } from '../api/stationFacilities'
import type { TransitAlert } from '../api/translink'
import { AudioPlayer } from './AudioPlayer'
import { LightMarkdown } from './LightMarkdown'

const QR = 'https://www.queenslandrail.com.au'

/**
 * Lift and escalator outages TransLink reports for a stop or its platforms. Shown
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
                <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-kumo-link hover:underline">
                  More from TransLink <ArrowSquareOutIcon size={14} />
                </a>
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
          <a href={f.guide} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-kumo-tint">
            <MapTrifoldIcon size={16} className="text-kumo-subtle" aria-hidden />
            <span className="flex-1">Queensland Rail station map (PDF)</span>
            <ArrowSquareOutIcon size={14} className="text-kumo-subtle" aria-hidden />
          </a>
        )}
      </div>

      <Text size="xs" variant="secondary">
        Queensland Rail station details, published by Brisbane City Council (
        <a href={STATION_FACILITIES_URL} target="_blank" rel="noreferrer" className="text-kumo-link hover:underline">
          Railway station facilities
        </a>
        , CC BY 4.0). Lift outages come from TransLink's real-time alerts.
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
