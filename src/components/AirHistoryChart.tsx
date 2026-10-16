import type { AirParameter, AirReading } from '../api/airHistory'
import { axisLabel as fmt, segments } from '../lib/airChart'

const HOUR = 3_600_000
const shortTime = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', hour: 'numeric' })
const shortDay = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short' })

interface Props {
  readings: AirReading[]
  parameter: AirParameter
  range: { start: number; end: number }
}

/**
 * A plain SVG line of a station's hourly readings over the chosen period, with
 * the department's running average where it publishes one and its hourly
 * guideline as a dashed line. An hour the department gives no reading for
 * breaks the line rather than being bridged.
 */
export function AirHistoryChart({ readings, parameter, range }: Props) {
  const W = 360
  const H = 140
  const pad = { l: 40, r: 8, t: 8, b: 18 }
  const values = readings.flatMap((r) => [r.value, ...(r.runningAvg != null ? [r.runningAvg] : [])])
  const lo = Math.min(0, ...values)
  const hi = Math.max(...values, parameter.hourStandard ?? 0, lo + 1)
  const x = (t: number) => pad.l + ((t - range.start) / Math.max(1, range.end - range.start)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - lo) / Math.max(1e-9, hi - lo)) * (H - pad.t - pad.b)
  const long = range.end - range.start > 2 * 24 * HOUR
  const label = long ? shortDay : shortTime

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${parameter.name} over the period, in ${parameter.units}`}>
      <line x1={pad.l} x2={W - pad.r} y1={y(lo)} y2={y(lo)} className="stroke-kumo-line" />
      <text x={pad.l - 4} y={y(hi) + 4} textAnchor="end" className="fill-kumo-subtle text-[10px]">
        {fmt(hi)}
      </text>
      <text x={pad.l - 4} y={y(lo)} textAnchor="end" className="fill-kumo-subtle text-[10px]">
        {fmt(lo)}
      </text>
      <text x={pad.l} y={H - 4} className="fill-kumo-subtle text-[10px]">
        {label.format(range.start)}
      </text>
      <text x={W - pad.r} y={H - 4} textAnchor="end" className="fill-kumo-subtle text-[10px]">
        {label.format(range.end)}
      </text>
      {parameter.hourStandard != null && (
        <>
          <line x1={pad.l} x2={W - pad.r} y1={y(parameter.hourStandard)} y2={y(parameter.hourStandard)} strokeDasharray="4 3" className="stroke-red-600" />
          <text x={W - pad.r} y={y(parameter.hourStandard) + (y(parameter.hourStandard) < pad.t + 12 ? 11 : -3)} textAnchor="end" className="fill-red-600 text-[10px]">
            1-hour guideline {fmt(parameter.hourStandard)}
          </text>
        </>
      )}
      {segments(readings, (r) => r.runningAvg).map((seg, i) => (
        <polyline key={`avg${i}`} points={seg.map(([t, v]) => `${x(t)},${y(v)}`).join(' ')} fill="none" strokeWidth={1.5} className="stroke-kumo-subtle" />
      ))}
      {segments(readings, (r) => r.value).map((seg, i) =>
        seg.length === 1 ? (
          <circle key={`v${i}`} cx={x(seg[0][0])} cy={y(seg[0][1])} r={2} className="fill-sky-700" />
        ) : (
          <polyline key={`v${i}`} points={seg.map(([t, v]) => `${x(t)},${y(v)}`).join(' ')} fill="none" strokeWidth={2} className="stroke-sky-700" />
        ),
      )}
    </svg>
  )
}
