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
}

export function EventCard({ event, now, distanceKm, upcoming, onSelect }: Props) {
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

  return (
    <button
      type="button"
      onClick={() => onSelect(p.id)}
      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-kumo-tint focus-visible:bg-kumo-tint focus-visible:outline-none"
    >
      <TypeIcon type={p.event_type} />
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5">
        <div className="grid min-w-0 gap-0.5">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <Text bold truncate>
              {eventTitle(event)}
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
    </button>
  )
}
