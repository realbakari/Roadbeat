import { Badge, Banner, Button, Text } from '@cloudflare/kumo'
import { ArrowLeftIcon, CarProfileIcon, CoffeeIcon, DropIcon, ToiletIcon, TruckIcon, VanIcon, WarningIcon, WheelchairIcon, type Icon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { stripHtml } from '../lib/format'
import { LAYER_COLOR } from '../lib/mapIcons'
import type { Place } from '../lib/places'
import { truckSubtitle } from '../lib/trucks'
import { wazeLabel } from '../lib/waze'
import { WarningBody } from './WarningDetail'
import { Header } from './PlaceParts'
import { ExternalLink } from './ui/Links'
import { Section } from './ui/Section'
import { CycloneBody, NswFireBody, PastCycloneBody } from './HazardPlaces'
import { SpeedCameraBody } from './SpeedCameraParts'
import { ClearanceBody } from './place/ClearancePlace'
import { BikeBody, EventBody, ToiletBody } from './place/CouncilAmenities'
import { CentreBody, OutageBody } from './place/DashboardPlaces'
import { Directions } from './place/Directions'
import { AirBody, HotspotBody } from './place/EnvironmentPlaces'
import { BayBody, ClearwayBody, MeterBody } from './place/ParkingPlaces'
import { RelativeTime } from './ui/RelativeTime'
import { FuelBody } from './FuelParts'

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
            subtitle={truckSubtitle(place.data) ?? t.roads}
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
            icon={w.type === 'ACCIDENT' ? CarProfileIcon : WarningIcon}
            color={LAYER_COLOR.waze}
            title={`${wazeLabel(w)} reported`}
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
              <dd><RelativeTime at={w.pubMillis} now={now} /></dd>
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
    case 'hotspot':
      return <HotspotBody h={place.data} now={now} />
    case 'warning':
      return <WarningBody w={place.data} />
    case 'nswfire':
      return <NswFireBody f={place.data} />
    case 'cyclone':
      return <CycloneBody c={place.data} now={now} />
    case 'pastcyclone':
      return <PastCycloneBody c={place.data} />
    case 'speedcamera':
      return <SpeedCameraBody c={place.data} />
    case 'fuel':
      return <FuelBody s={place.data} now={now} />
  }
}

function Amenity({ on, icon: I, children }: { on: boolean; icon: Icon; children: ReactNode }) {
  return (
    <Badge variant={on ? 'green' : 'outline'} icon={on ? <I weight="fill" /> : undefined}>
      <span className={on ? '' : 'text-kumo-subtle line-through'}>{children}</span>
    </Badge>
  )
}
