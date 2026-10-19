import { Badge, Button, Text } from '@cloudflare/kumo'
import { ArrowLeftIcon, CloudRainIcon, WavesIcon } from '@phosphor-icons/react'
import { GAUGES_DATASET_URL, type Gauge, type GaugeReading } from '../api/bccGauges'
import { BOM_QLD_WARNINGS, floodWarningArea } from '../api/floodWarnings'
import { qldGaugeUrl, WMIP_PORTAL } from '../api/qldGauges'
import { changeWithin, latestReading, rainfallTotal } from '../lib/gauges'
import { ExternalLink, InlineLink } from './ui/Links'
import { Section } from './ui/Section'
import { Header } from './PlaceParts'
import { LAYER_COLOR } from '../lib/mapIcons'
import { brisbaneDayClock as time } from '../lib/aest'
import { RelativeTime } from './ui/RelativeTime'

const HOUR = 60 * 60_000

/** One gauge: its latest reading, recent change or rainfall, and the last 24 hours. State gauges publish the latest reading only. */
export function GaugeDetail({ gauge, now, onBack }: { gauge: Gauge; now: number; onBack: () => void }) {
  const latest = latestReading(gauge)
  const stream = gauge.kind === 'stream'
  const hour = changeWithin(gauge, HOUR)
  const day = changeWithin(gauge, 24 * HOUR)
  const warningArea = floodWarningArea(gauge.id)
  const council = gauge.source === 'bcc'
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center border-b border-kumo-line px-2 py-2">
        <Button variant="ghost" size="sm" icon={<ArrowLeftIcon />} onClick={onBack}>
          Back
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-6 px-4 pt-4 pb-8">
          <Header
            icon={stream ? WavesIcon : CloudRainIcon}
            color={stream ? LAYER_COLOR.gaugeStream : LAYER_COLOR.gaugeRain}
            title={gauge.name}
            badges={
              <>
                <Badge variant="outline">{stream ? 'Stream height' : 'Rainfall'}</Badge>
                <Badge variant="outline">{council ? 'Gauge' : 'Station'} {gauge.id}</Badge>
                <Badge variant="outline">{council ? 'Brisbane City Council' : 'Queensland Government'}</Badge>
              </>
            }
          />

          {!latest ? (
            <Text variant="secondary">This gauge hasn't reported in the last 24 hours.</Text>
          ) : stream ? (
            <div className="grid gap-1">
              <span className="text-base font-semibold tabular-nums">{latest.value.toFixed(2)} m</span>
              <Text size="sm" variant="secondary">
                {council ? 'Above the Australian Height Datum (AHD)' : "Gauge height on the station's own datum"}, measured {time.format(latest.time)} AEST ·{' '}
                <RelativeTime at={latest.time} now={now} inline />.
              </Text>
              {council ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
                  <Change label="Last hour" change={hour} />
                  <Change label="Last 24 hours" change={day} />
                </div>
              ) : (
                <Text size="sm" variant="secondary">
                  The portal publishes the latest reading only, so there is no trend here. The station's page has its recent readings.
                </Text>
              )}
            </div>
          ) : (
            <div className="grid gap-1">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <Total label="Last hour" mm={rainfallTotal(gauge, now - HOUR)} />
                <Total label="Last 24 hours" mm={rainfallTotal(gauge, now - 24 * HOUR)} />
              </div>
              <Text size="sm" variant="secondary">
                Sums of the gauge's 5-minute readings. Last reading {time.format(latest.time)} AEST · <RelativeTime at={latest.time} now={now} inline />.
              </Text>
            </div>
          )}

          {gauge.readings.length > 1 && (
            <Section title="Last 24 hours" spaced>
              <Chart readings={gauge.readings} unit={gauge.unit} bars={!stream} />
              <Text size="xs" variant="secondary">
                {gauge.readings.length} readings. Each point is a reading the gauge sent; gaps are times it sent nothing.
              </Text>
            </Section>
          )}

          {stream && (
            <Section title="Flood warnings" spaced>
              <Text size="sm" variant="secondary">
                This page shows heights only. The Bureau of Meteorology issues flood warnings and sets the minor, moderate and major flood
                levels.
                {warningArea && ` This gauge is in BoM's ${warningArea.catchment} warning area.`}
              </Text>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {warningArea && (
                  <ExternalLink href={warningArea.url}>Flood warning for this area (BoM)</ExternalLink>
                )}
                <ExternalLink href={BOM_QLD_WARNINGS}>All Queensland warnings (BoM)</ExternalLink>
              </div>
            </Section>
          )}

          {council ? (
            <div className="grid gap-1">
              <ExternalLink href={GAUGES_DATASET_URL}>Brisbane City Council telemetry data</ExternalLink>
              <Text size="xs" variant="secondary">
                Raw readings from Brisbane City Council's gauges, which also feed the Bureau of Meteorology's flood warnings. CC BY 4.0.
                Warning areas: Bureau of Meteorology, National Flood Gauge Network, CC BY 4.0.
              </Text>
            </div>
          ) : (
            <div className="grid gap-1">
              <ExternalLink href={qldGaugeUrl(gauge.id)}>This station on the Water Monitoring Information Portal</ExternalLink>
              <Text size="xs" variant="secondary">
                Latest telemetered stream water level from the Queensland Government's{' '}
                <InlineLink href={WMIP_PORTAL}>Water Monitoring Information Portal</InlineLink>
                , Department of Local Government, Water and Volunteers. CC BY 4.0.
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Change({ label, change }: { label: string; change: ReturnType<typeof changeWithin> }) {
  return (
    <span>
      <span className="text-kumo-subtle">{label}: </span>
      {change ? (
        <span className="font-medium tabular-nums">
          {change.delta === 0 ? 'no change' : `${change.delta > 0 ? 'up' : 'down'} ${Math.abs(change.delta).toFixed(2)} m`}
        </span>
      ) : (
        <span className="text-kumo-subtle">only one reading</span>
      )}
    </span>
  )
}

function Total({ label, mm }: { label: string; mm: number | null }) {
  return (
    <span className="grid">
      <span className="text-base font-semibold tabular-nums">{mm != null ? `${mm} mm` : 'No reading'}</span>
      <span className="text-xs text-kumo-subtle">{label}</span>
    </span>
  )
}

/** A plain SVG chart of the readings: a line for stream heights, bars for 5-minute rainfall. */
function Chart({ readings, unit, bars }: { readings: GaugeReading[]; unit: string; bars: boolean }) {
  const W = 360
  const H = 120
  const pad = { l: 36, r: 8, t: 8, b: 18 }
  const t0 = readings[0].time
  const t1 = readings.at(-1)!.time
  const values = readings.map((r) => r.value)
  const lo = bars ? 0 : Math.min(...values)
  const hi = Math.max(...values, bars ? 1 : lo + 0.1)
  const x = (t: number) => pad.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - lo) / Math.max(1e-9, hi - lo)) * (H - pad.t - pad.b)
  const fmt = (v: number) => (bars ? v.toFixed(0) : v.toFixed(2))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Readings over the last 24 hours, in ${unit}`}>
      <line x1={pad.l} x2={W - pad.r} y1={y(lo)} y2={y(lo)} className="stroke-kumo-line" />
      <text x={pad.l - 4} y={y(hi) + 4} textAnchor="end" className="fill-kumo-subtle text-[10px]">
        {fmt(hi)}
      </text>
      <text x={pad.l - 4} y={y(lo)} textAnchor="end" className="fill-kumo-subtle text-[10px]">
        {fmt(lo)}
      </text>
      <text x={pad.l} y={H - 4} className="fill-kumo-subtle text-[10px]">
        {time.format(t0)}
      </text>
      <text x={W - pad.r} y={H - 4} textAnchor="end" className="fill-kumo-subtle text-[10px]">
        {time.format(t1)}
      </text>
      {bars ? (
        readings.map((r) => <rect key={r.time} x={x(r.time) - 1} y={y(r.value)} width={2} height={y(lo) - y(r.value)} className="fill-teal-600" />)
      ) : (
        <>
          <polyline points={readings.map((r) => `${x(r.time)},${y(r.value)}`).join(' ')} fill="none" strokeWidth={2} className="stroke-sky-700" />
          {readings.length < 40 && readings.map((r) => <circle key={r.time} cx={x(r.time)} cy={y(r.value)} r={2.5} className="fill-sky-700" />)}
        </>
      )}
    </svg>
  )
}
