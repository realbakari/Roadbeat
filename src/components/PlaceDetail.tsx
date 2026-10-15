import { Badge, Banner, Button, Text } from '@cloudflare/kumo'
import {
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  CoffeeIcon,
  DropIcon,
  MapPinIcon,
  ToiletIcon,
  TruckIcon,
  VanIcon,
  WarningIcon,
  WheelchairIcon,
  CarProfileIcon,
  type Icon,
} from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import type { DumpPoint, RestArea, TruckRestriction, WazeReport } from '../api/types'
import { timeAgo } from '../lib/format'
import { LAYER_COLOR } from '../lib/mapIcons'

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

export type Place =
  | { kind: 'rest'; data: RestArea }
  | { kind: 'dump'; data: DumpPoint }
  | { kind: 'truck'; data: TruckRestriction }
  | { kind: 'waze'; data: WazeReport }

interface Props {
  place: Place
  now: number
  onBack: () => void
}

export function PlaceDetail({ place, now, onBack }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center border-b border-kumo-line px-2 py-2">
        <Button variant="ghost" size="sm" icon={<ArrowLeftIcon />} onClick={onBack}>
          Back
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-6 px-4 pt-4 pb-8">{body(place, now)}</div>
      </div>
    </div>
  )
}

function body(place: Place, now: number) {
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
            description={stripHtml(t.description)}
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
  }
}

function Header({ icon: I, color, title, subtitle }: { icon: Icon; color: string; title: string; subtitle: string }) {
  return (
    <header className="flex items-start gap-3">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ backgroundColor: color }}
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
      </a>
      <span className="inline-flex items-center text-sm text-kumo-subtle tabular-nums">
        {lat.toFixed(4)}, {lng.toFixed(4)}
      </span>
    </div>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-kumo-link hover:underline">
      {children}
      <ArrowSquareOutIcon size={14} />
    </a>
  )
}

function stripHtml(s: string) {
  return s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}
