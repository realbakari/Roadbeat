import type { ReactNode } from 'react'

/** A dashboard panel: title, optional source note, and content. */
export function Tile({
  title,
  source,
  children,
  className = '',
}: {
  title: string
  source?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`flex min-h-0 min-w-0 flex-col gap-3 rounded-xl bg-kumo-base px-5 py-4 ring ring-kumo-line ${className}`}>
      <h2 className="text-base font-semibold text-kumo-strong">{title}</h2>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {source && <p className="text-xs text-kumo-subtle">{source}</p>}
    </section>
  )
}

/** A headline number with its label. */
export function Stat({ label, value, tone = '', href }: { label: string; value: ReactNode; /** Text colour classes for the number. */ tone?: string; href?: string }) {
  const body = (
    <>
      <span className={`text-3xl font-semibold tabular-nums xl:text-4xl ${tone}`}>
        {value}
      </span>
      <span className="text-sm text-kumo-subtle">{label}</span>
    </>
  )
  const cls = 'grid min-w-0 gap-1 rounded-xl bg-kumo-base px-5 py-4 ring ring-kumo-line'
  return href ? (
    <a href={href} className={`${cls} hover:bg-kumo-tint`}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** One row of a ranked list: label on the left, value on the right, with an optional bar. */
export function Row({
  label,
  detail,
  value,
  bar,
  color,
  barClass = '',
  href,
}: {
  label: ReactNode
  detail?: ReactNode
  value: ReactNode
  /** 0–1 share of the row's width to fill. */
  bar?: number
  color?: string
  /** Colour classes for the bar, in place of color. */
  barClass?: string
  href?: string
}) {
  const body = (
    <>
      <span className="relative flex min-w-0 items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm">
          {label}
          {detail && <span className="text-kumo-subtle"> · {detail}</span>}
        </span>
        <span className="shrink-0 text-sm font-medium tabular-nums">{value}</span>
      </span>
      {bar != null && (
        <span className="h-1.5 overflow-hidden rounded-full bg-kumo-tint">
          <span className={`block h-full rounded-full ${barClass}`} style={{ width: `${Math.min(1, bar) * 100}%`, backgroundColor: barClass ? undefined : (color ?? 'var(--color-kumo-brand)') }} />
        </span>
      )}
    </>
  )
  return (
    <li>
      {href ? (
        <a href={href} className="-mx-2 grid min-w-0 gap-1 rounded-md px-2 py-1 hover:bg-kumo-tint">
          {body}
        </a>
      ) : (
        <div className="grid min-w-0 gap-1 py-1">{body}</div>
      )}
    </li>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm text-kumo-subtle">{children}</p>
}
