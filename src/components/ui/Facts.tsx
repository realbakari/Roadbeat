import { Text } from '@cloudflare/kumo'
import type { ReactNode } from 'react'

const COLUMNS = { auto: 'grid-cols-[auto_1fr]', wide: 'grid-cols-[minmax(7rem,auto)_1fr]' }

/** A published label/value list. Rows the source left empty are skipped rather than shown blank. */
export function Facts({ rows, labelWidth = 'auto' }: { rows: [string, ReactNode][]; labelWidth?: keyof typeof COLUMNS }) {
  const visible = rows.filter(([, v]) => v)
  if (!visible.length) return <Text variant="secondary">Not provided</Text>
  return (
    <dl className={`grid ${COLUMNS[labelWidth]} gap-x-4 gap-y-1.5 text-sm`}>
      {visible.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-kumo-subtle">{k}</dt>
          <dd className="text-kumo-default">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
