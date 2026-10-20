import { Banner, Select } from '@cloudflare/kumo'
import { CrosshairIcon, GasPumpIcon, MapTrifoldIcon, ProhibitIcon, SealCheckIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useMemo, useState, type CSSProperties } from 'react'
import { centsText, FUEL_NO_REPUBLISH, fuelNotice } from '../api/fuelStations'
import { RelativeTime } from '../components/ui/RelativeTime'
import { useFuelStations } from '../hooks/useHazardFeeds'
import { titleCase } from '../lib/format'
import { brandedName, fuelNames, setFuelLabel, useFuelLabel } from '../lib/fuelBrands'
import { FUEL_RADII, fuelAreas, fuelNear, matchAreas, type FuelOrigin, type FuelRadius, type FuelRow, type FuelSort } from '../lib/fuelNearby'
import { chipClass } from '../components/chip'
import { FeedEnd, FeedSkeleton } from './FeedParts'
import { Rail } from './PostCard'

// The timeline's Fuel tab: stations near the reader, or near a suburb they
// pick, that report the chosen fuel, as posts on a fuel lane, cheapest or
// nearest first. Prices are as each retailer last reported them to Fuel
// Prices Queensland. The licence asks for its notice wherever prices appear,
// and prices may not be passed on, so there's no share button here.

const LANE = 'var(--lane-fuel)'
const SOURCE = 'Fuel Prices Queensland'

function StationPost({ row, now, radius }: { row: FuelRow; now: number; radius: FuelRadius }) {
  const { station: s, price, km } = row
  const others = s.fuels.filter((f) => f.name !== price.name && f.cents != null).slice(0, 4)
  return (
    <article className={`grid grid-cols-[4rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_minmax(0,1fr)] ${row.fresh ? '' : 'opacity-70'}`}>
      <Rail
        lane={LANE}
        incoming={null}
        tail="dot"
        node={
          <span className="flex rounded-full bg-kumo-base">
            <span className="flex rounded-full border-2 p-0.5" style={{ borderColor: 'var(--lane)' } as CSSProperties}>
              <span className="flex size-10 items-center justify-center rounded-full text-white" style={{ backgroundColor: price.available ? '#15803d' : '#b91c1c' }}>
                {price.available ? <GasPumpIcon size={20} weight="fill" /> : <ProhibitIcon size={20} weight="bold" />}
              </span>
            </span>
          </span>
        }
      />
      <div className="min-w-0 border-b border-kumo-line py-3 pr-4">
        <div className="flex min-w-0 items-baseline gap-1.5 text-[15px]">
          <span className="max-w-[70%] shrink-0 truncate font-semibold text-kumo-strong">{brandedName(s)}</span>
          <span className="min-w-0 shrink-[4] truncate font-mono text-[13px] text-kumo-subtle">{titleCase(s.suburb)}</span>
          <span className="ml-auto shrink-0 font-mono text-[13px] text-kumo-subtle tabular-nums">{km < 10 ? km.toFixed(1) : Math.round(km)} km</span>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {price.cents != null ? (
            <span className="font-mono text-2xl font-semibold text-kumo-strong tabular-nums">
              {centsText(price.cents)}
              <span className="ml-1 font-sans text-sm font-normal text-kumo-subtle">c/L</span>
            </span>
          ) : (
            <span className="rounded-md border border-dashed border-kumo-danger px-2 py-0.5 text-sm font-semibold text-kumo-danger">Unavailable</span>
          )}
          <span className="font-mono text-xs text-kumo-subtle">{price.name}</span>
          {row.cheapest && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#15803d] px-2 py-0.5 text-xs font-semibold text-white">
              <SealCheckIcon size={13} weight="fill" aria-hidden /> Cheapest within {radius} km
            </span>
          )}
        </div>
        <p className={`m-0 mt-0.5 font-mono text-xs ${row.fresh ? 'text-kumo-subtle' : 'text-kumo-warning'}`}>
          reported <RelativeTime at={price.reportedAt} now={now} inline />
          {!row.fresh && ' · may be out of date'}
        </p>
        {others.length > 0 && (
          <p className="m-0 mt-1 font-mono text-xs text-kumo-subtle">
            Also {others.map((f) => `${f.name} ${centsText(f.cents ?? 0)}`).join(' · ')}
          </p>
        )}
        {s.address && <p className="m-0 mt-1 text-[13px] text-kumo-subtle">{s.address}</p>}
        <div className="mt-1 -ml-2 flex items-center text-[13px] text-kumo-subtle">
          <a href={`/#place/fuel/${encodeURIComponent(s.id)}`} className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 transition-colors hover:bg-kumo-tint hover:text-kumo-default pointer-coarse:min-h-9">
            <MapTrifoldIcon size={16} aria-hidden /> On the map
          </a>
        </div>
      </div>
    </article>
  )
}

/** The licence's notice and its ban on republishing, wherever prices appear. */
function Licence({ year }: { year: number }) {
  return (
    <p className="m-0 text-xs leading-relaxed text-kumo-subtle">
      <strong className="font-semibold text-kumo-default">{FUEL_NO_REPUBLISH}</strong> {fuelNotice(year)}
    </p>
  )
}

export function FuelFeed({ now }: { now: number }) {
  const feed = useFuelStations(true)
  const stations = feed.data
  const chosen = useFuelLabel()
  const names = useMemo(() => (stations ? fuelNames(stations) : []), [stations])
  const fuel = names.includes(chosen) ? chosen : (names[0] ?? chosen)
  const [sort, setSort] = useState<FuelSort>('cheapest')
  const [radius, setRadius] = useState<FuelRadius>(10)
  const [origin, setOrigin] = useState<FuelOrigin | null>(null)
  const [typed, setTyped] = useState('')
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const areas = useMemo(() => (stations ? fuelAreas(stations) : []), [stations])
  const suggestions = useMemo(() => matchAreas(areas, typed), [areas, typed])
  const rows = useMemo(() => (stations && origin ? fuelNear(stations, fuel, origin.center, radius, sort, now) : []), [stations, origin, fuel, radius, sort, now])

  const locate = () => {
    if (!navigator.geolocation) {
      setLocateError("This browser can't share its location; pick a suburb instead.")
      return
    }
    setLocating(true)
    setLocateError(null)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false)
        setOrigin({ center: [p.coords.longitude, p.coords.latitude], label: 'your location', kind: 'me' })
        setTyped('')
      },
      () => {
        setLocating(false)
        setLocateError("Couldn't get your location; pick a suburb instead.")
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  }

  return (
    <div>
      <div className="grid gap-3 border-b border-kumo-line px-4 py-3">
        <p className="m-0 text-[13px] leading-relaxed text-kumo-subtle">
          Prices and availability as each retailer last reported them to {SOURCE}. Retailers must report a change within 30 minutes. <strong className="font-semibold text-kumo-default">{FUEL_NO_REPUBLISH}</strong>
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Select
            aria-label="Fuel"
            size="sm"
            className="w-full"
            value={fuel}
            disabled={!names.length}
            onValueChange={(v) => setFuelLabel(typeof v === 'string' ? v : fuel)}
            items={Object.fromEntries((names.length ? names : [fuel]).map((n) => [n, n]))}
          />
          <button type="button" onClick={locate} className={chipClass(origin?.kind === 'me', 'justify-center')} disabled={locating}>
            <CrosshairIcon size={14} aria-hidden /> {locating ? 'Finding you…' : 'Use my location'}
          </button>
        </div>
        <div className="relative">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={origin?.kind === 'area' ? `Near ${origin.label}` : 'Or a suburb or postcode'}
            aria-label="Suburb or postcode"
            className="h-9 w-full rounded-md border border-kumo-line bg-kumo-base px-3 text-sm text-kumo-strong outline-none placeholder:text-kumo-subtle focus-visible:ring-2 focus-visible:ring-kumo-brand"
          />
          {suggestions.length > 0 && (
            <ul className="absolute inset-x-0 top-10 z-20 m-0 list-none overflow-hidden rounded-md border border-kumo-line bg-kumo-base p-0 shadow-md">
              {suggestions.map((a) => (
                <li key={`${a.name}-${a.postcode}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setOrigin({ center: a.center, label: `${a.name}${a.postcode ? ` ${a.postcode}` : ''}`, kind: 'area' })
                      setTyped('')
                    }}
                    className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-kumo-tint"
                  >
                    <span className="text-kumo-strong">
                      {a.name} <span className="font-mono text-xs text-kumo-subtle">{a.postcode}</span>
                    </span>
                    <span className="font-mono text-xs text-kumo-subtle">
                      {a.stations} {a.stations === 1 ? 'station' : 'stations'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {locateError && <p className="m-0 text-sm text-kumo-danger">{locateError}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          <div role="group" aria-label="Sort" className="flex gap-1.5">
            {(['cheapest', 'nearest'] as const).map((s) => (
              <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)} className={chipClass(sort === s)}>
                {s === 'cheapest' ? 'Cheapest' : 'Nearest'}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Within" className="ml-auto flex gap-1.5">
            {FUEL_RADII.map((r) => (
              <button key={r} type="button" aria-pressed={radius === r} onClick={() => setRadius(r)} className={chipClass(radius === r)}>
                {r} km
              </button>
            ))}
          </div>
        </div>
      </div>

      {feed.error && (
        <div className="px-4 pt-3">
          <Banner
            variant="alert"
            size="sm"
            icon={<WarningCircleIcon weight="fill" />}
            description={stations ? `Couldn't refresh fuel prices: ${feed.error}. Showing the last prices received.` : `Couldn't load fuel prices: ${feed.error}.`}
          />
        </div>
      )}

      {!stations && !feed.error ? (
        <FeedSkeleton label="Loading fuel prices" />
      ) : !stations ? null : !origin ? (
        <div className="grid justify-items-center gap-2 px-6 py-14 text-center sm:px-12">
          <p className="m-0 font-mono text-[13px] text-kumo-subtle">Where are you?</p>
          <p className="m-0 max-w-sm text-[15px] text-kumo-default">
            Use your location, or type a suburb or postcode, to see {fuel} prices at the {stations.length.toLocaleString('en-AU')} stations {SOURCE} lists. Your location stays in this browser.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="grid justify-items-center gap-2 px-6 py-14 text-center sm:px-12">
          <p className="m-0 font-mono text-[13px] text-kumo-subtle">No {fuel} within {radius} km</p>
          <p className="m-0 max-w-sm text-[15px] text-kumo-default">No station within {radius} km of {origin.label} reports {fuel}. Try a wider radius or another fuel.</p>
        </div>
      ) : (
        <>
          <p className="m-0 border-b border-kumo-line px-4 py-2 font-mono text-xs text-kumo-subtle">
            {rows.length} {rows.length === 1 ? 'station' : 'stations'} within {radius} km of {origin.label} · {sort === 'cheapest' ? 'cheapest first' : 'nearest first'}
            {feed.fetchedAt != null && (
              <>
                {' '}
                · prices read <RelativeTime at={feed.fetchedAt} now={now} inline />
              </>
            )}
          </p>
          <ul className="m-0 list-none p-0">
            {rows.map((r) => (
              <li key={r.station.id}>
                <StationPost row={r} now={now} radius={radius} />
              </li>
            ))}
          </ul>
          <FeedEnd>{`That's every station within ${radius} km that reports ${fuel}.`}</FeedEnd>
        </>
      )}

      {stations && (
        <div className="border-t border-kumo-line px-4 py-4">
          <Licence year={new Date(feed.fetchedAt ?? now).getFullYear()} />
        </div>
      )}
    </div>
  )
}
