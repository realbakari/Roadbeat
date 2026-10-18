import { Banner, Text } from '@cloudflare/kumo'
import { LetterCirclePIcon, ProhibitIcon, WarningIcon, WheelchairIcon } from '@phosphor-icons/react'
import { Fragment, type ReactNode } from 'react'
import { ACCESSIBLE_PARKING_URL, CLEARWAYS_URL, PARKING_METERS_URL, type AccessibleBay, type Clearway, type ParkingMeter } from '../../api/bccPlaces'
import { clearwayInEffect, parseClearwayTimes } from '../../lib/clearways'
import { LAYER_COLOR } from '../../lib/mapIcons'
import { Header } from '../PlaceParts'
import { ExternalLink } from '../ui/Links'
import { Section } from '../ui/Section'
import { Directions } from './Directions'

// Brisbane City Council's kerbside places: clearways, parking meters and accessible bays.

export function ClearwayBody({ c, now }: { c: Clearway; now: number }) {
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

const dollars = (n: number) => `$${n.toFixed(2)}`

export function MeterBody({ m }: { m: ParkingMeter }) {
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

export function BayBody({ b }: { b: AccessibleBay }) {
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
