import { Text } from '@cloudflare/kumo'
import { CaretDownIcon, CaretUpIcon, FlameIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { FIRE_COLOR, FIRE_TEXT, fireKindLabel, type FireWarning } from '../api/bushfires'
import { timeAgo } from '../lib/format'
import { readableTextOn } from '../lib/routeColor'

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
        <span className={`flex h-lh items-center ${FIRE_TEXT[top.level]}`}>
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
            // As in EventCard: the name is a heading holding the button, stretched over the row.
            <li key={f.id} className="relative flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-kumo-tint has-[:focus-visible]:bg-kumo-tint has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-kumo-brand has-[:focus-visible]:ring-inset">
                <span
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: FIRE_COLOR[f.level], color: readableTextOn(FIRE_COLOR[f.level]) }}
                  aria-hidden
                >
                  <FlameIcon size={11} weight="fill" />
                </span>
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <Text as="h3" size="sm">
                    <button
                      type="button"
                      onClick={() => onOpen(`fire/${encodeURIComponent(f.id)}`)}
                      className="line-clamp-2 w-full text-left break-words after:absolute after:inset-0 focus-visible:outline-none"
                    >
                      {f.area ?? f.title}
                    </button>
                  </Text>
                  <span className="flex flex-wrap gap-x-2 text-xs text-kumo-subtle">
                    <span className={f.level === 'Information' ? 'font-medium' : `font-medium ${FIRE_TEXT[f.level]}`}>
                      {f.level === 'Information' ? fireKindLabel(f) : f.levelText}
                    </span>
                    {f.location && <span className="truncate">{f.location}</span>}
                    {f.status && <span>{f.status}</span>}
                    {f.issued && <span>{timeAgo(f.issued, now)}</span>}
                  </span>
                </div>
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
