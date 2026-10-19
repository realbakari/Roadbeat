import { Text } from '@cloudflare/kumo'
import { FireSimpleIcon, HurricaneIcon, PathIcon } from '@phosphor-icons/react'
import { BOM_CYCLONES, CYCLONE_COLOR, JTWC_PAGE, type Cyclone } from '../api/jtwc'
import { NSW_ALERT_COLOR, NSW_FIRES_ATTRIBUTION, NSW_FIRES_PAGE, type NswFire } from '../api/nswFires'
import { IBTRACS_CITATION, IBTRACS_PAGE, PAST_CYCLONE_COLOR, pastCycloneTitle, type PastCyclone } from '../api/pastCyclones'
import { Header } from './PlaceParts'
import { ExternalLink } from './ui/Links'
import { Section } from './ui/Section'
import { Facts } from './ui/Facts'
import { brisbaneDayDateTime as aest, brisbaneDateOnly as dayOnly } from '../lib/aest'
import { RelativeTime } from './ui/RelativeTime'

/** One NSW RFS incident near the border, with every field as the RFS publishes it. */
export function NswFireBody({ f }: { f: NswFire }) {
  return (
    <>
      <Header icon={FireSimpleIcon} color={NSW_ALERT_COLOR[f.alertLevel] ?? NSW_ALERT_COLOR['Not Applicable']} title={f.title} subtitle={`NSW Rural Fire Service · ${f.alertLevel}`} />
      <Text size="sm" variant="secondary">
        A fire in New South Wales near the Queensland border. For warnings in Queensland, follow the Queensland Fire Department.
      </Text>
      <Section title="As published">
        <Facts rows={f.fields.length ? f.fields : [['Alert level', f.alertLevel]]} />
      </Section>
      {f.published && (
        <Text size="xs" variant="secondary">
          Feed time {f.published} (NSW time).
        </Text>
      )}
      <div className="grid gap-1">
        <ExternalLink href={NSW_FIRES_PAGE}>Fires Near Me, NSW RFS</ExternalLink>
        <Text size="xs" variant="secondary">
          {NSW_FIRES_ATTRIBUTION}. CC BY 4.0.
        </Text>
      </div>
    </>
  )
}

/** A JTWC tropical cyclone warning: its warning position and JTWC's forecast, point by point as published. */
export function CycloneBody({ c, now }: { c: Cyclone; now: number }) {
  const title = c.name ? `Tropical cyclone ${c.name}` : `Tropical cyclone ${c.id}`
  return (
    <>
      <Header icon={HurricaneIcon} color={CYCLONE_COLOR} title={title} subtitle={`US Joint Typhoon Warning Center · ${c.id}`} />
      <div className="grid gap-1 rounded-lg bg-kumo-recessed p-3">
        <Text size="sm">Not the official Australian warning</Text>
        <Text size="xs" variant="secondary">
          The Bureau of Meteorology issues Queensland's cyclone warnings. JTWC is a US military centre whose forecasts can differ. For what to do,
          follow the Bureau and your local council.
        </Text>
        <ExternalLink href={BOM_CYCLONES}>Bureau of Meteorology cyclone warnings</ExternalLink>
      </div>
      <Text size="sm" variant="secondary">
        Warning {c.warning ?? 'number not given'}, issued {aest.format(c.issuedAt)} AEST · <RelativeTime at={c.issuedAt} now={now} inline />
      </Text>
      <Section title="Position and JTWC forecast">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-kumo-subtle">
                <th className="py-1 pr-3 font-normal">Time (AEST)</th>
                <th className="py-1 pr-3 font-normal">Position</th>
                <th className="py-1 font-normal">Wind</th>
              </tr>
            </thead>
            <tbody>
              {c.points.map((p) => (
                <tr key={p.tau} className="border-t border-kumo-line">
                  <td className="py-1 pr-3">
                    {aest.format(p.validAt)}
                    <span className="block text-xs text-kumo-subtle">{p.tau === 0 ? 'Warning position' : `Forecast, +${p.tau} h`}</span>
                  </td>
                  <td className="py-1 pr-3 tabular-nums">
                    {Math.abs(p.position[1]).toFixed(1)}° S, {p.position[0].toFixed(1)}° E
                  </td>
                  <td className="py-1 tabular-nums">{p.windKt ? `${p.windKt} kt (${Math.round(p.windKt * 1.852)} km/h)` : 'Not given'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Text size="xs" variant="secondary">
        Winds are JTWC's one-minute average; the Bureau of Meteorology uses ten-minute averages, which read lower. km/h converted from knots.
      </Text>
      <div className="grid gap-1">
        <ExternalLink href={c.textUrl}>JTWC warning text</ExternalLink>
        <ExternalLink href={JTWC_PAGE}>Joint Typhoon Warning Center</ExternalLink>
      </div>
    </>
  )
}

/** A past cyclone's reported track, as history. */
export function PastCycloneBody({ c }: { c: PastCyclone }) {
  const first = c.points[0]
  const last = c.points.at(-1)!
  return (
    <>
      <Header icon={PathIcon} color={PAST_CYCLONE_COLOR} title={pastCycloneTitle(c)} subtitle="Past tropical cyclone track" />
      <Text size="sm" variant="secondary">
        History for context, not a current warning. Positions are the ones agencies reported; recent seasons are provisional.
      </Text>
      <Section title="Track">
        <Facts
          rows={[
            ['Season', String(c.season)],
            ['Reported from', dayOnly.format(first.at)],
            ['Reported until', dayOnly.format(last.at)],
            ['Reported positions', String(c.points.length)],
            ['Peak wind', c.peakKt ? `${c.peakKt} kt (${Math.round(c.peakKt * 1.852)} km/h), ${c.agency ?? 'WMO agency'}` : 'Not recorded'],
          ]}
        />
      </Section>
      <div className="grid gap-1">
        <ExternalLink href={IBTRACS_PAGE}>IBTrACS, NOAA NCEI</ExternalLink>
        <Text size="xs" variant="secondary">
          {IBTRACS_CITATION}. km/h converted from knots.
        </Text>
      </div>
    </>
  )
}
