import { Badge, Select, Text } from '@cloudflare/kumo'
import { GasPumpIcon } from '@phosphor-icons/react'
import { centsText, FUEL_NO_REPUBLISH, FUEL_STATUS_LABEL, fuelNotice, type FuelStation } from '../api/fuelStations'
import { brisbaneDayDateTime } from '../lib/aest'
import { feedNotice } from '../lib/feedNotice'
import { titleCase } from '../lib/format'
import { brandCounts, fuelNames, setFuelBrands, setFuelLabel, useFuelBrands, useFuelLabel } from '../lib/fuelBrands'
import { chipClass } from './chip'
import { LAYER_COLOR } from '../lib/mapIcons'
import type { Feed } from '../hooks/useHazardFeeds'
import { Facts } from './ui/Facts'
import { RelativeTime } from './ui/RelativeTime'
import { Header } from './PlaceParts'
import { Section } from './ui/Section'

// The fuel layer's note and a service station's page, from Fuel Prices
// Queensland. The licence asks for its notice wherever the data is shown and
// for further publication to be prohibited, so both appear with the prices.

const SOURCE = 'Queensland Government fuel price reporting (Fuel Prices Queensland)'

const COLOR: Record<FuelStation['status'], string> = {
  available: LAYER_COLOR.fuelAvailable,
  partial: LAYER_COLOR.fuelPartial,
  unavailable: LAYER_COLOR.fuelUnavailable,
  unknown: LAYER_COLOR.fuelUnknown,
}

/** The licence's notice and its ban on republishing, in small print. */
function Licence({ year }: { year: number }) {
  return (
    <Text size="xs" variant="secondary">
      {FUEL_NO_REPUBLISH} {fuelNotice(year)}
    </Text>
  )
}

export function FuelNote({ feed }: { feed: Feed<FuelStation[]> }) {
  const notice = feedNotice('Fuel prices', feed.data != null, feed.error, feed.fetchedAt)
  return (
    <div className="grid gap-1.5">
      {notice && <Text size="xs" variant="error">{notice}</Text>}
      <Text size="xs" variant="secondary">
        Prices and availability at each service station, from {SOURCE}. Retailers must report a price change within 30 minutes; each price shows when it was reported. Roadbeat reads them every 2 minutes.
      </Text>
      {feed.data && <PriceLabel stations={feed.data} />}
      {feed.data && <BrandFilter stations={feed.data} />}
      {feed.fetchedAt != null && <Licence year={new Date(feed.fetchedAt).getFullYear()} />}
    </div>
  )
}

/** Which fuel's price labels the stations on the map, or none. Remembered in this browser. */
function PriceLabel({ stations }: { stations: FuelStation[] }) {
  const chosen = useFuelLabel()
  const names = fuelNames(stations)
  return (
    <Select
      aria-label="Price shown on the map"
      size="sm"
      className="w-full"
      value={chosen}
      onValueChange={(v) => setFuelLabel((v as string) ?? '')}
      items={{ '': 'No prices on the map', ...Object.fromEntries(names.map((n) => [n, `${n} prices on the map`])) }}
    />
  )
}

/** Brand chips that narrow the layer to the chosen brands; none chosen shows every station. Remembered in this browser. */
function BrandFilter({ stations }: { stations: FuelStation[] }) {
  const chosen = useFuelBrands()
  const toggle = (b: string) => setFuelBrands(chosen.includes(b) ? chosen.filter((x) => x !== b) : [...chosen, b])
  return (
    <details open={chosen.length > 0}>
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

/** One service station: each fuel's price as reported, and when. */
export function FuelBody({ s, now }: { s: FuelStation; now: number }) {
  return (
    <>
      <Header icon={GasPumpIcon} color={COLOR[s.status]} title={s.name} subtitle={FUEL_STATUS_LABEL[s.status]} />
      {s.brand && (
        <div>
          <Badge variant="outline">{s.brand}</Badge>
        </div>
      )}
      <Section title="Prices">
        {s.fuels.length ? (
          <ul className="grid text-sm">
            {s.fuels.map((f) => (
              <li key={f.id} className="flex items-baseline justify-between gap-4 border-b border-kumo-line py-1.5 last:border-0">
                <span className="grid">
                  <span>{f.name}</span>
                  <span className="text-xs text-kumo-subtle" title={`${brisbaneDayDateTime.format(f.reportedAt)} AEST`}>
                    Reported <RelativeTime at={f.reportedAt} now={now} inline />
                  </span>
                </span>
                {f.cents != null ? (
                  <span className="font-semibold tabular-nums">
                    {centsText(f.cents)} <span className="text-xs font-normal text-kumo-subtle">c/L</span>
                  </span>
                ) : (
                  <span className="font-medium text-kumo-danger">Unavailable</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Text size="sm" variant="secondary">
            This station hasn't reported any fuel prices.
          </Text>
        )}
      </Section>
      <Section title="Station">
        <Facts rows={[['Address', [s.address, titleCase(s.suburb), s.postcode].filter(Boolean).join(', ') || null]]} />
      </Section>
      <Text size="sm" variant="secondary">
        Prices and availability as the retailer last reported them, which can lag what's at the bowser. Call the station before a long trip.
      </Text>
      <div className="grid gap-1">
        <Text size="xs" variant="secondary">
          From {SOURCE}.
        </Text>
        <Licence year={new Date(now).getFullYear()} />
      </div>
    </>
  )
}
