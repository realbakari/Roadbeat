import { Loader, Text } from '@cloudflare/kumo'
import { useEffect, useState } from 'react'
import {
  CRASH_DATA_END,
  CRASH_DATASET_URL,
  fetchCrashSummary,
  SEVERITIES,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  type CrashSummary,
} from '../api/crashes'
import type { LngLat } from '../lib/geo'
import { InlineLink } from './ui/Links'

/** Five-year crash history around a point, from TMR's police-reported crash data. */
export function CrashNearby({ at }: { at: LngLat }) {
  const [summary, setSummary] = useState<CrashSummary | null>(null)
  const [failed, setFailed] = useState(false)
  const [lng, lat] = at

  useEffect(() => {
    const c = new AbortController()
    setSummary(null)
    setFailed(false)
    fetchCrashSummary([lng, lat], c.signal).then(setSummary, () => !c.signal.aborted && setFailed(true))
    return () => c.abort()
  }, [lng, lat])

  return (
    <div className="grid gap-3">
      {failed ? (
        <Text variant="secondary">Crash history is unavailable right now.</Text>
      ) : !summary ? (
        <Loader size="sm" />
      ) : summary.total === 0 ? (
        <Text variant="secondary">
          No reported crashes within {summary.radiusKm} km from {summary.from} to {summary.to}.
        </Text>
      ) : (
        <Summary s={summary} />
      )}
      <Text size="xs" variant="secondary">
        Historical police-reported crashes to {CRASH_DATA_END}; the last 12 months are preliminary and may change.{' '}
        <InlineLink href={CRASH_DATASET_URL}>Transport and Main Roads, CC BY 4.0</InlineLink>
      </Text>
    </div>
  )
}

function Summary({ s }: { s: CrashSummary }) {
  const present = SEVERITIES.filter((k) => s.bySeverity[k] > 0)
  const pct = (n: number) => `${Math.round((n / s.total) * 100)}%`

  return (
    <>
      <Text>
        <strong className="tabular-nums">{s.total.toLocaleString()}</strong> casualty crashes within {s.radiusKm} km,{' '}
        {s.from} – {s.to}
      </Text>

      <div className="grid gap-2">
        <div className="flex h-3 overflow-hidden rounded-full bg-kumo-recessed" role="img" aria-label="Crashes by severity">
          {present.map((k) => (
            <div
              key={k}
              style={{ width: `${(s.bySeverity[k] / s.total) * 100}%`, background: SEVERITY_COLOR[k] }}
              title={`${SEVERITY_LABEL[k]}: ${s.bySeverity[k]}`}
            />
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
          {present.map((k) => (
            <li key={k} className="flex items-center gap-1.5 text-sm">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[k] }} />
              <span className="flex-1 text-kumo-subtle">{SEVERITY_LABEL[k]}</span>
              <span className="tabular-nums">{s.bySeverity[k]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="On wet roads" value={s.wet} share={pct(s.wet)} />
        <Stat label="At night" value={s.night} share={pct(s.night)} />
      </div>

      <TopList title="Most common crash types" items={s.natures} />
      <TopList title="Most common movements" items={s.dcaGroups} />
    </>
  )
}

function Stat({ label, value, share }: { label: string; value: number; share: string }) {
  return (
    <div className="rounded-lg bg-kumo-recessed px-3 py-2">
      <Text size="xs" variant="secondary">
        {label}
      </Text>
      <Text bold>
        <span className="tabular-nums">{value}</span>{' '}
        <span className="font-normal text-kumo-subtle">({share})</span>
      </Text>
    </div>
  )
}

function TopList({ title, items }: { title: string; items: [string, number][] }) {
  if (!items.length) return null
  return (
    <div className="grid gap-1">
      <Text size="xs" variant="secondary">
        {title}
      </Text>
      <ol className="grid gap-0.5">
        {items.map(([name, n]) => (
          <li key={name} className="flex justify-between gap-3 text-sm">
            <span>{name}</span>
            <span className="text-kumo-subtle tabular-nums">{n}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
