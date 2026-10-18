import { CaretDownIcon, CaretUpIcon, TrafficConeIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { ROAD_OCCUPANCIES_URL, type RoadOccupancy } from '../api/bccRoadOccupancies'
import { inHoursNow, occupanciesToday, occupancyMatches, sortOccupancies } from '../lib/roadOccupancies'
import { InlineLink } from './ui/Links'

const fmt = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

/**
 * Brisbane City Council's planned road occupancies for today, collapsed to one
 * line above the road events (council roads aren't in QLDTraffic's feed). These
 * are permits; the list says so rather than claiming crews are on site.
 */
export function CouncilWorksList({ occupancies, query, now }: { occupancies: RoadOccupancy[]; query: string; now: number }) {
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState(false)
  const today = useMemo(
    () => sortOccupancies(occupanciesToday(occupancies, now).filter((o) => !query.trim() || occupancyMatches(o, query)), now),
    [occupancies, query, now],
  )
  if (!today.length) return null
  const full = today.filter((o) => /full closure/i.test(o.closure)).length
  const nowCount = today.filter((o) => inHoursNow(o, now)).length
  const shown = all ? today : today.slice(0, 12)

  return (
    <section className="mx-4 mt-3 overflow-hidden rounded-lg ring ring-kumo-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 bg-kumo-recessed px-3 py-2 text-left hover:bg-kumo-tint"
      >
        <span className="flex h-lh items-center text-kumo-warning">
          <TrafficConeIcon size={16} weight="fill" />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-sm font-medium">
            {today.length} Brisbane council road {today.length === 1 ? 'occupancy' : 'occupancies'} today
            {full > 0 && ` · ${full} full ${full === 1 ? 'closure' : 'closures'}`}
          </span>
          {!open && (
            <span className="truncate text-xs text-kumo-subtle">
              {nowCount} within permitted hours now · planned lane and road closures on council roads
            </span>
          )}
        </span>
        <span className="flex h-lh items-center text-kumo-subtle">{open ? <CaretUpIcon size={14} /> : <CaretDownIcon size={14} />}</span>
      </button>
      {open && (
        <ul className="divide-y divide-kumo-line border-t border-kumo-line">
          {shown.map((o) => {
            const live = inHoursNow(o, now)
            return (
              <li key={o.id} className="grid gap-0.5 px-3 py-2">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm">
                    {o.road}
                    {o.suburb && <span className="text-kumo-subtle"> · {o.suburb}</span>}
                  </span>
                  {live && <span className="shrink-0 text-xs font-medium text-kumo-warning">Permitted now</span>}
                </span>
                <span className="flex flex-wrap gap-x-2 text-xs text-kumo-subtle">
                  <span className={/full closure/i.test(o.closure) ? 'font-medium text-kumo-danger' : 'font-medium'}>{o.closure}</span>
                  {o.from && <span>{o.to ? `${o.from} to ${o.to}` : `at ${o.from}`}</span>}
                  {o.direction && <span>{o.direction}</span>}
                  <span>
                    {o.period}
                    {o.period !== 'Continuously' && o.startTime && o.finishTime && `, ${fmt(o.startTime)} to ${fmt(o.finishTime)}`}
                  </span>
                  {o.work && <span>{o.work}</span>}
                </span>
              </li>
            )
          })}
          {today.length > shown.length && (
            <li>
              <button type="button" onClick={() => setAll(true)} className="w-full px-3 py-2 text-left text-sm text-kumo-link hover:bg-kumo-tint">
                Show all {today.length}
              </button>
            </li>
          )}
          <li className="px-3 py-1.5 text-xs text-kumo-subtle">
            Permits for planned occupancies; works may not run every day of a permit. Source:{' '}
            <InlineLink href={ROAD_OCCUPANCIES_URL}>Brisbane City Council</InlineLink>{' '}
            (CC BY 4.0)
          </li>
        </ul>
      )}
    </section>
  )
}
