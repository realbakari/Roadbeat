import { CaretDownIcon, CaretUpIcon, FlameIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { FIRE_COLOR, fireKindLabel, type FireWarning } from '../api/bushfires'
import { timeAgo } from '../lib/format'

/**
 * Queensland Fire Department warnings and fires, collapsed to one line above the
 * road events so they're always visible but never crowd the list. Warnings
 * (Advice and above) come first; incidents follow.
 */
export function FireList({ fires, now, onOpen }: { fires: FireWarning[]; now: number; onOpen: (hash: string) => void }) {
  const [open, setOpen] = useState(false)
  const [allIncidents, setAllIncidents] = useState(false)
  if (!fires.length) return null
  const warnings = fires.filter((f) => f.level !== 'Information')
  const incidents = fires.filter((f) => f.level === 'Information')
  const top = fires[0]
  const summary = [
    warnings.length ? `${warnings.length} bushfire ${warnings.length === 1 ? 'warning' : 'warnings'}` : null,
    incidents.length ? `${incidents.length} ${incidents.length === 1 ? 'fire' : 'fires'} reported` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const shownIncidents = allIncidents ? incidents : incidents.slice(0, 8)

  return (
    <section className="mx-4 mt-3 overflow-hidden rounded-lg ring ring-kumo-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 bg-kumo-recessed px-3 py-2 text-left hover:bg-kumo-tint"
      >
        <span className="flex h-lh items-center" style={{ color: FIRE_COLOR[top.level] }}>
          <FlameIcon size={16} weight="fill" />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-sm font-medium">{summary}</span>
          {!open && (
            <span className="truncate text-xs text-kumo-subtle">
              {top.level === 'Information' ? 'Queensland Fire Department incidents' : `${top.levelText}: ${top.area ?? top.title}`}
            </span>
          )}
        </span>
        <span className="flex h-lh items-center text-kumo-subtle">{open ? <CaretUpIcon size={14} /> : <CaretDownIcon size={14} />}</span>
      </button>
      {open && (
        <ul className="divide-y divide-kumo-line border-t border-kumo-line">
          {[...warnings, ...shownIncidents].map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => onOpen(`fire/${encodeURIComponent(f.id)}`)} className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-kumo-tint">
                <span
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: FIRE_COLOR[f.level] }}
                  aria-hidden
                >
                  <FlameIcon size={11} weight="fill" />
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-sm">{f.area ?? f.title}</span>
                  <span className="flex flex-wrap gap-x-2 text-xs text-kumo-subtle">
                    <span className="font-medium" style={{ color: f.level === 'Information' ? undefined : FIRE_COLOR[f.level] }}>
                      {f.level === 'Information' ? fireKindLabel(f) : f.levelText}
                    </span>
                    {f.location && <span className="truncate">{f.location}</span>}
                    {f.status && <span>{f.status}</span>}
                    {f.issued && <span>{timeAgo(f.issued, now)}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {incidents.length > shownIncidents.length && (
            <li>
              <button type="button" onClick={() => setAllIncidents(true)} className="w-full px-3 py-2 text-left text-sm text-kumo-link hover:bg-kumo-tint">
                Show all {incidents.length} fires
              </button>
            </li>
          )}
          <li className="px-3 py-1.5 text-xs text-kumo-subtle">Source: Queensland Fire Department (CC BY 4.0)</li>
        </ul>
      )}
    </section>
  )
}
