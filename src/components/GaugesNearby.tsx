import { Loader, Text } from '@cloudflare/kumo'
import { ArrowSquareOutIcon, CaretRightIcon } from '@phosphor-icons/react'
import type { Gauge } from '../api/bccGauges'
import { floodWarningArea } from '../api/floodWarnings'
import { timeAgo } from '../lib/format'
import { changeWithin, latestReading, nearbyGauges, rainfallSince } from '../lib/gauges'
import type { LngLat } from '../lib/geo'

/** How far from a flooding event to look for Brisbane City Council gauges. */
const RADIUS_KM = 5
const HOUR = 60 * 60_000

/**
 * Live readings from the Brisbane City Council gauges closest to a flooding
 * event: stream heights with their change over the last hour, and rainfall.
 * Renders nothing outside the council's network.
 */
export function GaugesNearby({
  at,
  gauges,
  now,
  onOpen,
}: {
  at: LngLat
  gauges: Gauge[] | null
  now: number
  onOpen: (hash: string) => void
}) {
  if (!gauges) return <Loader size="sm" />
  const streams = nearbyGauges(gauges, at, RADIUS_KM, 'stream').slice(0, 4)
  const rain = nearbyGauges(gauges, at, RADIUS_KM, 'rain').slice(0, 2)
  if (!streams.length && !rain.length) return null
  const area = streams.map((s) => floodWarningArea(s.gauge.id)).find(Boolean)
  return (
    <div className="grid gap-1.5">
      <ul className="divide-y divide-kumo-line overflow-hidden rounded-lg ring ring-kumo-line">
        {[...streams, ...rain].map(({ gauge: g, km }) => {
          const latest = latestReading(g)
          const hour = g.kind === 'stream' ? changeWithin(g, HOUR) : null
          return (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => onOpen(`gauge/${encodeURIComponent(g.id)}`)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-kumo-tint"
              >
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-sm">{g.name}</span>
                  <span className="text-xs text-kumo-subtle">
                    {g.kind === 'stream' ? 'Stream height' : 'Rainfall'} · {km.toFixed(1)} km
                    {latest && ` · ${timeAgo(latest.time, now)}`}
                  </span>
                </span>
                <span className="grid shrink-0 justify-items-end text-sm tabular-nums">
                  {g.kind === 'stream' ? (
                    <>
                      <span className="font-medium">{latest ? `${latest.value.toFixed(2)} m` : '—'}</span>
                      {hour && hour.delta !== 0 && (
                        <span className="text-xs text-kumo-subtle">
                          {hour.delta > 0 ? 'up' : 'down'} {Math.abs(hour.delta).toFixed(2)} m in 1 hr
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="font-medium">{rainfallSince(g, now - HOUR).mm} mm</span>
                      <span className="text-xs text-kumo-subtle">last hour</span>
                    </>
                  )}
                </span>
                <CaretRightIcon size={14} className="shrink-0 text-kumo-inactive" />
              </button>
            </li>
          )
        })}
      </ul>
      <Text size="xs" variant="secondary">
        Raw readings from Brisbane City Council gauges within {RADIUS_KM} km. Heights are metres above the Australian Height
        Datum, not flood levels.
      </Text>
      {area && (
        <a href={area.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-kumo-link hover:underline">
          BoM flood warning for {area.catchment} <ArrowSquareOutIcon size={14} />
        </a>
      )}
    </div>
  )
}
