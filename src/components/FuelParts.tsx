import { Badge, Text } from '@cloudflare/kumo'
import { GasPumpIcon } from '@phosphor-icons/react'
import { DASHBOARDS_PAGE, FUEL_STATUS_LABEL, type FuelStation } from '../api/fuelAvailability'
import dashboards from '../data/council-dashboards.json'
import { feedNotice } from '../lib/feedNotice'
import { brandCounts, setFuelBrands, useFuelBrands } from '../lib/fuelBrands'
import { chipClass } from './chip'
import { LAYER_COLOR } from '../lib/mapIcons'
import type { Feed } from '../hooks/useHazardFeeds'
import { ExternalLink, InlineLink } from './ui/Links'
import { Facts } from './ui/Facts'
import { RelativeTime } from './ui/RelativeTime'
import { Header } from './PlaceParts'
import { Section } from './ui/Section'

// The fuel layer's note and a service station's page. Availability only:
// the source also has prices, which the state's licence keeps from being
// republished, so Roadbeat doesn't show them.

const CREDIT = "Queensland Government fuel price reporting, as council disaster dashboards publish it"

const COLOR: Record<FuelStation['status'], string> = {
  available: LAYER_COLOR.fuelAvailable,
  partial: LAYER_COLOR.fuelPartial,
  unavailable: LAYER_COLOR.fuelUnavailable,
  unknown: LAYER_COLOR.fuelUnknown,
}

/** The council's own disaster dashboard, when Roadbeat's list has one for the station's council area. */
function dashboardFor(council: string | null) {
  const d = council ? (dashboards.dashboards as string[][]).find((x) => x[1] === council) : undefined
  return d ? { name: d[0], url: d[2] } : null
}

export function FuelNote({ feed }: { feed: Feed<FuelStation[]> }) {
  const notice = feedNotice('Fuel status', feed.data != null, feed.error, feed.fetchedAt)
  return (
    <div className="grid gap-1">
      {notice && <Text size="xs" variant="error">{notice}</Text>}
      <Text size="xs" variant="secondary">
        Whether each service station has fuel, from the {CREDIT}. Each station shows when it was last updated; prices aren't shown. Find your council's dashboard on the{' '}
        <InlineLink href={DASHBOARDS_PAGE}>state's list</InlineLink>.
      </Text>
      {feed.data && <BrandFilter stations={feed.data} />}
    </div>
  )
}

/** Brand chips that narrow the layer to the chosen brands; none chosen shows every station. Remembered in this browser. */
function BrandFilter({ stations }: { stations: FuelStation[] }) {
  const chosen = useFuelBrands()
  const toggle = (b: string) => setFuelBrands(chosen.includes(b) ? chosen.filter((x) => x !== b) : [...chosen, b])
  return (
    <details className="mt-1" open={chosen.length > 0}>
      <summary className="cursor-pointer text-xs font-medium text-kumo-default">{chosen.length ? `Showing ${chosen.join(', ')}` : 'Show only some brands'}</summary>
      <div role="group" aria-label="Brands" className="mt-2 flex flex-wrap gap-1.5">
        {brandCounts(stations).map(([b, n]) => (
          <button key={b} type="button" aria-pressed={chosen.includes(b)} onClick={() => toggle(b)} className={chipClass(chosen.includes(b))}>
            {b} <span className="text-kumo-subtle tabular-nums">{n}</span>
          </button>
        ))}
        {chosen.length > 0 && (
          <button type="button" onClick={() => setFuelBrands([])} className="text-sm text-kumo-link underline decoration-1 underline-offset-2">
            Show all brands
          </button>
        )}
      </div>
    </details>
  )
}

/** One service station, as the fuel layer describes it. */
export function FuelBody({ s, now }: { s: FuelStation; now: number }) {
  const dash = dashboardFor(s.council)
  return (
    <>
      <Header icon={GasPumpIcon} color={COLOR[s.status]} title={s.name} subtitle={FUEL_STATUS_LABEL[s.status]} />
      {s.brand && (
        <div>
          <Badge variant="outline">{s.brand}</Badge>
        </div>
      )}
      <Section title="Fuels">
        {s.fuels.length ? (
          <ul className="grid gap-1 text-sm">
            {s.fuels.map((f) => (
              <li key={f.name} className="flex justify-between gap-4 border-b border-kumo-line py-1.5 last:border-0">
                <span>{f.name}</span>
                <span className={f.available ? 'text-kumo-success' : 'font-medium text-kumo-danger'}>{f.available ? 'Available' : 'Unavailable'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Text size="sm" variant="secondary">
            The source lists no fuels for this station.
          </Text>
        )}
      </Section>
      <Section title="Station">
        <Facts
          rows={[
            ['Address', [s.address, s.postcode].filter(Boolean).join(' ') || null],
            ['Council area', s.council],
            ['Last updated', s.updatedAt ? <RelativeTime key="updated" at={s.updatedAt} now={now} /> : 'Not given'],
          ]}
        />
      </Section>
      <Text size="sm" variant="secondary">
        Availability as last reported, which can lag what's at the bowser. Call the station before a long trip.
      </Text>
      <div className="grid gap-1">
        {dash ? <ExternalLink href={dash.url}>{dash.name} disaster dashboard</ExternalLink> : <ExternalLink href={DASHBOARDS_PAGE}>Council disaster dashboards</ExternalLink>}
        <Text size="xs" variant="secondary">
          From the {CREDIT}.
        </Text>
      </div>
    </>
  )
}
