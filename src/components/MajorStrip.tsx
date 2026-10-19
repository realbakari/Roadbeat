import { CaretRightIcon, ProhibitIcon, SirenIcon, WarningIcon, type Icon } from '@phosphor-icons/react'
import { FIRE_COLOR, FIRE_TEXT } from '../api/bushfires'
import type { EventFilters } from '../lib/filters'
import type { MajorLevel, MajorSummary } from '../lib/majorIncidents'

/** Each major level's accent, and a text colour with enough contrast for words. */
const LEVEL: Record<MajorLevel, { color: string; text: string; icon: Icon }> = {
  'Emergency Warning': { color: FIRE_COLOR['Emergency Warning'], text: FIRE_TEXT['Emergency Warning'], icon: WarningIcon },
  'Red Alert': { color: FIRE_COLOR['Emergency Warning'], text: FIRE_TEXT['Emergency Warning'], icon: SirenIcon },
  'Watch and Act': { color: FIRE_COLOR['Watch and Act'], text: FIRE_TEXT['Watch and Act'], icon: WarningIcon },
}

interface Props {
  summary: MajorSummary
  onOpen: (href: string) => void
  /** Opens the event list with the filter change applied, as the header's counts do. */
  onShowEvents: (next: (f: EventFilters) => EventFilters) => void
  /** The header's feed status in words, which phones have no room for up there. */
  feedStatus: string
}

/**
 * The strip under the header. It leads with the most serious item published
 * anywhere (an Emergency Warning, a Red Alert, then Watch and Act) at every
 * width. Below the width where the header shows its counts, it also carries
 * warnings, closures and Red Alerts, and when the road events were updated.
 */
export function MajorStrip({ summary, onOpen, onShowEvents, feedStatus }: Props) {
  const top = summary.items[0]
  const more = summary.items.length - 1
  const showList = () => onShowEvents((f) => ({ ...f, when: 'now' }))
  const level = top ? LEVEL[top.level] : null

  return (
    <div
      className={`${top ? 'flex' : 'flex lg:hidden'} relative min-h-9 shrink-0 items-center gap-3 border-b border-kumo-line bg-kumo-base pr-4 pl-4 text-sm`}
      role="region"
      aria-label="Major incidents"
    >
      {top && level && (
        <>
          <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: level.color }} aria-hidden />
          <button type="button" onClick={() => onOpen(top.href)} className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left hover:underline lg:flex-none">
            <level.icon size={16} weight="fill" className={`shrink-0 ${level.text}`} aria-hidden />
            <span className={`shrink-0 font-semibold ${level.text}`}>{top.levelText}</span>
            <span className="min-w-0 truncate text-kumo-strong">{top.title}</span>
            <CaretRightIcon size={12} className="shrink-0 text-kumo-subtle" aria-hidden />
          </button>
          {more > 0 && (
            <button type="button" onClick={showList} className="shrink-0 py-1.5 whitespace-nowrap text-kumo-link hover:underline">
              {more} more
            </button>
          )}
        </>
      )}
      <div className={`${top ? 'hidden sm:flex' : 'flex'} min-w-0 items-center gap-3 overflow-x-auto [scrollbar-width:none] lg:hidden`}>
        <Count icon={WarningIcon} value={summary.warnings} one="warning" many="warnings" onClick={showList} />
        <Count
          icon={ProhibitIcon}
          value={summary.closures}
          one="closure"
          many="closures"
          danger
          onClick={() => onShowEvents((f) => ({ ...f, when: 'now', closuresOnly: true }))}
        />
        <Count
          icon={SirenIcon}
          value={summary.redAlerts}
          one="Red Alert"
          many="Red Alerts"
          danger
          onClick={() => onShowEvents((f) => ({ ...f, when: 'now', priority: 'Red Alert' }))}
        />
      </div>
      <span className="ml-auto hidden shrink-0 text-xs whitespace-nowrap text-kumo-subtle min-[400px]:inline lg:hidden" aria-hidden>
        {feedStatus}
      </span>
    </div>
  )
}

function Count({ icon: I, value, one, many, danger, onClick }: { icon: Icon; value: number | null; one: string; many: string; danger?: boolean; onClick: () => void }) {
  const alert = danger && value != null && value > 0
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap hover:underline">
      <I size={14} weight="bold" className={alert ? 'text-kumo-danger' : 'text-kumo-subtle'} aria-hidden />
      {/* "…" while the feed hasn't loaded, never a 0 that hasn't been read. */}
      <span className={`font-semibold tabular-nums ${alert ? 'text-kumo-danger' : 'text-kumo-strong'}`}>{value ?? '…'}</span>
      <span className="text-kumo-subtle">{value === 1 ? one : many}</span>
    </button>
  )
}
