import { Text } from '@cloudflare/kumo'
import { CaretDownIcon, CaretUpIcon, WarningIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { FIRE_TEXT } from '../api/bushfires'
import { WARNING_COLOR, type QldWarning, type WarningLevel } from '../api/qldWarnings'
import { readableTextOn } from '../lib/routeColor'

/** Level text colours with enough contrast for words, the bushfire list's own. */
const LEVEL_TEXT: Record<WarningLevel, string> = {
  'Emergency Warning': FIRE_TEXT['Emergency Warning'],
  'Watch and Act': FIRE_TEXT['Watch and Act'],
  Advice: FIRE_TEXT.Advice,
  Other: FIRE_TEXT.Information,
}

/**
 * Queensland Disaster Management's storm, flood, cyclone and other hazard
 * warnings, as one card above the road events. It opens by itself while any
 * warning is at Watch and Act or higher. Warnings come highest level first, as
 * the feed is sorted.
 */
export function WarningList({ warnings, onOpen }: { warnings: QldWarning[]; onOpen: (hash: string) => void }) {
  const serious = warnings.some((w) => w.level === 'Emergency Warning' || w.level === 'Watch and Act')
  const [open, setOpen] = useState(serious)
  if (!warnings.length) return null
  const top = warnings[0]
  const summary = `${warnings.length} hazard ${warnings.length === 1 ? 'warning' : 'warnings'}`

  return (
    <section className="mx-4 mt-3 overflow-hidden rounded-lg ring ring-kumo-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 bg-kumo-recessed px-3 py-2 text-left hover:bg-kumo-tint"
      >
        <span className={`flex h-lh items-center ${LEVEL_TEXT[top.level]}`}>
          <WarningIcon size={16} weight="fill" />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-sm font-medium">{summary}</span>
          {!open && <span className="truncate text-xs text-kumo-subtle">{`${top.levelText}: ${top.area ?? top.title}`}</span>}
        </span>
        <span className="flex h-lh items-center text-kumo-subtle">{open ? <CaretUpIcon size={14} /> : <CaretDownIcon size={14} />}</span>
      </button>
      {open && (
        <ul className="divide-y divide-kumo-line border-t border-kumo-line">
          {warnings.map((w) => (
            // As in EventCard: the name is a heading holding the button, stretched over the row.
            <li key={w.id} className="relative flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-kumo-tint has-[:focus-visible]:bg-kumo-tint has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-kumo-brand has-[:focus-visible]:ring-inset">
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: WARNING_COLOR[w.level], color: readableTextOn(WARNING_COLOR[w.level]) }}
                aria-hidden
              >
                <WarningIcon size={11} weight="fill" />
              </span>
              <div className="grid min-w-0 flex-1 gap-0.5">
                <Text as="h3" size="sm">
                  <button
                    type="button"
                    onClick={() => onOpen(`place/warning/${encodeURIComponent(w.id)}`)}
                    className="line-clamp-2 w-full text-left break-words after:absolute after:inset-0 focus-visible:outline-none"
                  >
                    {w.area ?? w.title}
                  </button>
                </Text>
                {w.callToAction && <span className="line-clamp-2 text-xs text-kumo-default">{w.callToAction}</span>}
                <span className="flex flex-wrap gap-x-2 text-xs text-kumo-subtle">
                  <span className={`font-medium ${LEVEL_TEXT[w.level]}`}>{w.levelText}</span>
                  {w.type && <span>{w.type}</span>}
                  {w.from && <span className="truncate">{w.from}</span>}
                  {/* As the warning writes it; the feed's own timestamps are when it was regenerated. */}
                  {w.issued && <span>{w.issued}</span>}
                </span>
              </div>
            </li>
          ))}
          <li className="px-3 py-1.5 text-xs text-kumo-subtle">Source: Queensland Disaster Management (CC BY 4.0)</li>
        </ul>
      )}
    </section>
  )
}
