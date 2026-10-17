import { Badge, Text } from '@cloudflare/kumo'
import { ProhibitIcon } from '@phosphor-icons/react'
import type { TrafficEvent } from '../api/types'
import { priorityBadge, typeMeta } from '../lib/eventMeta'
import { clean, timeAgo } from '../lib/format'
import { eventPlace, eventTitle } from '../lib/eventText'
import { hasEnded, nextActiveDate } from '../lib/filters'
import { isClosure } from '../lib/filters'

const startsFmt = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Brisbane',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

export function TypeIcon({ type, size = 'md' }: { type: string; size?: 'md' | 'lg' }) {
  const meta = typeMeta(type)
  const Icon = meta.icon
  const box = size === 'lg' ? 'size-10 rounded-lg' : 'size-8 rounded-md'
  return (
    <span
      className={`${box} flex shrink-0 items-center justify-center text-white`}
      style={{ backgroundColor: meta.color }}
      aria-hidden
    >
      <Icon size={size === 'lg' ? 22 : 18} weight="fill" />
    </span>
  )
}


interface Props {
  event: TrafficEvent
  now: number
  distanceKm?: number | null
  upcoming?: boolean
  onSelect: (id: number) => void
  /** The title's heading level: h3 in the side panel's list, h4 under a place page's section heading. */
  headingAs?: 'h3' | 'h4'
}

export function EventCard({ event, now, distanceKm, upcoming, onSelect, headingAs = 'h3' }: Props) {
  const p = event.properties
  const meta = typeMeta(p.event_type)
  const pr = priorityBadge(p.event_priority)
  const subtype = clean(p.event_subtype)
  const impact = clean(p.impact?.impact_subtype) ?? clean(p.impact?.impact_type)
  const next = upcoming ? nextActiveDate(event, now) : null
  const ended = upcoming && hasEnded(event, now)
  const updated = ended
    ? `Ended ${startsFmt.format(new Date(p.duration!.end!))}`
    : next
      ? `Starts ${startsFmt.format(next)}`
      : timeAgo(p.last_updated, now)
  const place = eventPlace(event)

  // The title is a heading holding the button, and the button's ::after
  // stretches over the card, so the whole card stays one click target while
  // screen readers can jump from event to event by heading.
  return (
    <div className="relative flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-kumo-tint has-[:focus-visible]:bg-kumo-tint has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-kumo-brand has-[:focus-visible]:ring-inset">
      <TypeIcon type={p.event_type} />
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5">
        <div className="grid min-w-0 gap-0.5">
          <div className="flex min-w-0 items-start justify-between gap-2">
            {/* Two lines, not one: multi-road titles put the cross street last. */}
            <Text as={headingAs} bold>
              <button type="button" onClick={() => onSelect(p.id)} className="line-clamp-2 w-full text-left break-words after:absolute after:inset-0 focus-visible:outline-none">
                {eventTitle(event)}
              </button>
            </Text>
            {updated && (
              <span className="shrink-0 text-xs leading-5 text-kumo-subtle">{updated}</span>
            )}
          </div>
          {place && (
            <Text variant="secondary" size="sm" truncate>
              {place}
              {distanceKm != null && ` · ${distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km`}
            </Text>
          )}
        </div>
        {clean(p.description) && (
          <p className="line-clamp-2 text-sm text-kumo-default">{clean(p.description)}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={meta.badge}>{subtype ? `${p.event_type} · ${subtype}` : p.event_type}</Badge>
          {isClosure(event) ? (
            <Badge variant="red" icon={<ProhibitIcon weight="bold" />}>
              {impact ?? 'Closed'}
            </Badge>
          ) : (
            impact && <Badge variant="outline">{impact}</Badge>
          )}
          <Badge variant={pr.variant} appearance={pr.appearance}>
            {p.event_priority}
          </Badge>
        </div>
      </div>
    </div>
  )
}
