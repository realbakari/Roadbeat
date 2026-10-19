import { Select, Text } from '@cloudflare/kumo'
import { useEffect, useState } from 'react'
import {
  AIR_API_DATASET,
  AIR_TIMEFRAMES,
  departmentChartUrl,
  fetchAirParameters,
  fetchAirReadings,
  historyRange,
  type AirParameter,
  type AirReading,
  type AirTimeframe,
} from '../api/airHistory'
import { AirHistoryChart } from './AirHistoryChart'
import { brisbaneDate } from '../lib/aest'
import { ExternalLink } from './ui/Links'

const when = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric' })

interface Props {
  stationId: string
  now: number
}

// Each fetched answer remembers what it was fetched for, so a change of
// station, pollutant or period shows as loading until its own answer lands.
type Loaded<T> = { key: string; value: T | null; error: string | null }

const failed = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * The department's hourly readings for one pollutant at a station over a day,
 * week or month, as on its own chart page, with the period's end date chosen.
 */
export function AirHistory({ stationId, now }: Props) {
  const [params, setParams] = useState<Loaded<AirParameter[]> | null>(null)
  const [chosen, setChosen] = useState<number | null>(null)
  const [timeframe, setTimeframe] = useState<AirTimeframe>('day')
  const [date, setDate] = useState(() => brisbaneDate(now))
  const [loaded, setLoaded] = useState<Loaded<AirReading[]> | null>(null)

  useEffect(() => {
    const c = new AbortController()
    fetchAirParameters(stationId, c.signal).then(
      (value) => setParams({ key: stationId, value, error: null }),
      (e: unknown) => {
        if (!c.signal.aborted) setParams({ key: stationId, value: null, error: failed(e) })
      },
    )
    return () => c.abort()
  }, [stationId])

  const parameters = params?.key === stationId ? params.value : null
  const parameter = parameters && (parameters.find((p) => p.id === chosen) ?? parameters.find((p) => p.name === 'Particle PM2.5') ?? parameters[0] ?? null)
  const { start, end } = historyRange(timeframe, date, now)
  const key = parameter ? `${stationId}/${parameter.id}/${start}/${end}` : null

  useEffect(() => {
    if (!key || !parameter) return
    const c = new AbortController()
    fetchAirReadings(stationId, parameter.id, { start, end }, c.signal).then(
      (value) => setLoaded({ key, value, error: null }),
      (e: unknown) => {
        if (!c.signal.aborted) setLoaded({ key, value: null, error: failed(e) })
      },
    )
    return () => c.abort()
  }, [key, stationId, parameter, start, end])

  const readings = loaded?.key === key ? loaded : null
  const error = params?.key === stationId ? params.error : readings?.error
  const today = brisbaneDate(now)
  const timeframes = Object.fromEntries(Object.entries(AIR_TIMEFRAMES).map(([k, v]) => [k, v.label]))

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Select
          aria-label="Pollutant"
          size="sm"
          value={parameter ? String(parameter.id) : ''}
          onValueChange={(v) => setChosen(v ? Number(v) : null)}
          items={parameters ? Object.fromEntries(parameters.map((p) => [String(p.id), p.category === 2 ? `${p.name} (weather)` : p.name])) : { '': 'Loading…' }}
        />
        <Select aria-label="Period" size="sm" value={timeframe} onValueChange={(v) => setTimeframe((v as AirTimeframe) ?? 'day')} items={timeframes} />
        <input
          type="date"
          aria-label="Period ends on"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value || today)}
          className="h-8 rounded-md bg-kumo-base px-2 text-sm text-kumo-default ring ring-kumo-line"
        />
      </div>
      {error ? (
        <Text size="sm" variant="secondary">
          Readings unavailable: {error}.
        </Text>
      ) : parameter && readings?.value ? (
        readings.value.length ? (
          <>
            <AirHistoryChart readings={readings.value} parameter={parameter} range={{ start, end }} />
            <Summary readings={readings.value} parameter={parameter} hours={AIR_TIMEFRAMES[timeframe].hours} />
          </>
        ) : (
          <Text size="sm" variant="secondary">
            The department published no {parameter.name} readings for this station over this period.
          </Text>
        )
      ) : (
        <Text size="sm" variant="secondary">
          Loading readings…
        </Text>
      )}
      {parameter && (
        <div className="grid gap-0.5">
          {parameter.standard && (
            <Text size="xs" variant="secondary">
              Guideline: {parameter.standard.value} {parameter.standard.label}
              {parameter.hourStandard != null && `; ${parameter.hourStandard} ${parameter.units} for an hour`}.
            </Text>
          )}
          <Text size="xs" variant="secondary">
            Hourly values in {parameter.units}; the grey line is the department's running average where it publishes one. Hours it gives no reading for are left blank.
          </Text>
          <ExternalLink href={departmentChartUrl(stationId, parameter.id, timeframe, date)}>This chart on the department's site</ExternalLink>
          <ExternalLink href={AIR_API_DATASET}>Air Quality Monitoring Data API (open data)</ExternalLink>
        </div>
      )}
    </div>
  )
}

function Summary({ readings, parameter, hours }: { readings: AirReading[]; parameter: AirParameter; hours: number }) {
  const peak = readings.reduce((a, b) => (b.value > a.value ? b : a))
  const validated = readings.filter((r) => r.validated).length
  const missing = hours - readings.length
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <span>
        <span className="text-kumo-subtle">Highest: </span>
        <span className="font-medium tabular-nums">
          {peak.value} {parameter.units}
        </span>
        <span className="text-kumo-subtle"> at {when.format(peak.time)}</span>
      </span>
      <span className="text-kumo-subtle">
        {validated === readings.length ? 'All' : validated === 0 ? 'None' : `${validated} of ${readings.length}`} of the readings validated by the department
        {missing > 0 && `; ${missing} of ${hours} hours without a reading`}.
      </span>
    </div>
  )
}
