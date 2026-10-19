import { Select, Text } from '@cloudflare/kumo'
import { CRASH_DATA_END, CRASH_DATASET_URL, CRASH_FIRST_YEAR, CRASH_LAST_YEAR, SEVERITIES, SEVERITY_COLOR, SEVERITY_LABEL, type CrashFilter } from '../../api/crashes'
import { toggleSeverity, withYear } from '../../lib/crashFilter'
import { chipClass } from '../chip'
import { InlineLink } from '../ui/Links'

const YEARS = Object.fromEntries(
  Array.from({ length: CRASH_LAST_YEAR - CRASH_FIRST_YEAR + 1 }, (_, i) => {
    const y = String(CRASH_LAST_YEAR - i)
    return [y, y]
  }),
)

/** The crash history layer's year range and severities. */
export function CrashControls({ filter, onChange }: { filter: CrashFilter; onChange: (f: CrashFilter) => void }) {
  const update = (next: CrashFilter) => {
    if (next !== filter) onChange(next)
  }
  const setYear = (key: 'from' | 'to', v: string | null) => update(withYear(filter, key, v))
  const toggle = (s: CrashFilter['severities'][number]) => update(toggleSeverity(filter, s))

  return (
    <div className="grid gap-2 rounded-lg bg-kumo-recessed p-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
        <Select aria-label="From year" size="sm" className="w-full" value={String(filter.from)} onValueChange={(v) => setYear('from', v as string)} items={YEARS} />
        <Text size="xs" variant="secondary">
          to
        </Text>
        <Select aria-label="To year" size="sm" className="w-full" value={String(filter.to)} onValueChange={(v) => setYear('to', v as string)} items={YEARS} />
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Crash severity">
        {SEVERITIES.map((s) => {
          const on = filter.severities.includes(s)
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s)}
              className={chipClass(on)}
            >
              <span className="size-2 rounded-full" style={{ background: SEVERITY_COLOR[s], opacity: on ? 1 : 0.4 }} />
              {SEVERITY_LABEL[s]}
            </button>
          )
        })}
      </div>
      <Text size="xs" variant="secondary">
        Property-damage-only crashes were recorded until 2010. Data to {CRASH_DATA_END}.{' '}
        <InlineLink href={CRASH_DATASET_URL}>Transport and Main Roads, CC BY 4.0</InlineLink>
      </Text>
    </div>
  )
}
