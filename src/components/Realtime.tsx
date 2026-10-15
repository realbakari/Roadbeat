import { Tabs } from '@cloudflare/kumo'
import { useTimeFormat, type TimeFormat } from '../lib/timeFormat'

/**
 * A reported delay the way the TransLink app shows it: whole minutes next to
 * the scheduled time, "+0" when running to schedule, red when early or late.
 */
export function DelayChip({ delay, className = '' }: { delay: number | null | undefined; className?: string }) {
  if (delay == null) return null
  const m = Math.round(delay / 60)
  const on = m === 0
  return (
    <span
      className={`rounded px-1 text-xs font-semibold tabular-nums ${on ? 'bg-kumo-success/15 text-kumo-success' : 'bg-kumo-danger/10 text-kumo-danger'} ${className}`}
      title={on ? 'Running on time' : `${Math.abs(m)} min ${m > 0 ? 'late' : 'early'}, as reported`}
    >
      {on ? '+0' : m > 0 ? `+${m}` : `−${-m}`}
    </span>
  )
}

export function TimeFormatToggle() {
  const [f, setF] = useTimeFormat()
  return (
    <Tabs
      size="sm"
      value={f}
      onValueChange={(v) => setF(v as TimeFormat)}
      tabs={[
        { value: 'clock', label: '5:42 pm' },
        { value: 'minutes', label: 'In 5 min' },
      ]}
    />
  )
}
