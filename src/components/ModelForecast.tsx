import { Text } from '@cloudflare/kumo'
import { BOM_FORECASTS, DWD_ICON_PAGE, OPEN_METEO_PAGE, upcoming } from '../api/modelForecast'
import { useModelForecast } from '../hooks/useHazardFeeds'
import type { LngLat } from '../lib/geo'
import { distanceKm } from '../lib/geo'
import { InlineLink } from './ui/Links'
import { brisbaneDayDateTime as run } from '../lib/aest'

const hour = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', hour: 'numeric' })
/** How many hours to list, every third hour, so the table stays short: 24 hours. */
const HOURS = 24
const STEP = 3

/**
 * A raw computer model forecast for a place: the DWD ICON model via Open-Meteo,
 * every third hour for the next day. Loaded only when this section is shown.
 * Labelled as model output with its run time, never as an official forecast.
 */
export function ModelForecast({ at, now }: { at: LngLat; now: number }) {
  const feed = useModelForecast(at)
  const f = feed.data
  const rows = f ? upcoming(f, now, HOURS).filter((_, i) => i % STEP === 0) : []
  return (
    <div className="grid gap-2">
      <div className="grid gap-0.5 rounded-lg bg-kumo-recessed p-3">
        <Text size="sm">Computer model, not a Bureau of Meteorology forecast</Text>
        <Text size="xs" variant="secondary">
          Raw output from Germany's DWD ICON weather model, which can be wrong by hours or kilometres. For forecasts and warnings to act on, use the{' '}
          <InlineLink href={BOM_FORECASTS}>Bureau of Meteorology</InlineLink>
          .
        </Text>
      </div>
      {feed.error ? (
        <Text size="sm" variant="secondary">
          Model forecast unavailable: {feed.error}.
        </Text>
      ) : !f ? (
        <Text size="sm" variant="secondary">
          Loading the model forecast…
        </Text>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-kumo-subtle">
                  <th className="py-1 pr-3 font-normal">Hour (AEST)</th>
                  <th className="py-1 pr-3 font-normal">Rain</th>
                  <th className="py-1 pr-3 font-normal">Wind</th>
                  <th className="py-1 font-normal">Temp</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.time} className="border-t border-kumo-line">
                    <td className="py-1 pr-3">{hour.format(h.time)}</td>
                    <td className="py-1 pr-3">{h.rainMm != null ? `${h.rainMm} mm` : '–'}</td>
                    <td className="py-1 pr-3">{h.windKmh != null ? `${Math.round(h.windKmh)} km/h${h.gustKmh != null ? `, gusts ${Math.round(h.gustKmh)}` : ''}` : '–'}</td>
                    <td className="py-1">{h.tempC != null ? `${Math.round(h.tempC)}°C` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Text size="xs" variant="secondary">
            {f.runAt ? `Model run ${run.format(f.runAt)} AEST. ` : 'Model run time not given. '}
            Rain is the model's total for each hour shown. Grid point {distanceKm(at, f.gridPoint).toFixed(0)} km from the place's centre.{' '}
            <InlineLink href={DWD_ICON_PAGE}>DWD ICON</InlineLink>{' '}
            via{' '}
            <InlineLink href={OPEN_METEO_PAGE}>Open-Meteo</InlineLink>{' '}
            (CC BY 4.0).
          </Text>
        </>
      )}
    </div>
  )
}
