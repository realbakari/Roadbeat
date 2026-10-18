import type { TrafficEvent } from '../api/types'
import { typeMeta } from '../lib/eventMeta'
import { RelativeTime } from '../components/ui/RelativeTime'

/** Rolling strip of the latest road events along the bottom of the dashboard. Pauses on hover. */
export function Ticker({ events, now }: { events: TrafficEvent[]; now: number }) {
  if (!events.length) return null
  const items = events.map((e) => {
    const p = e.properties
    const meta = typeMeta(p.event_type)
    const updated = Date.parse(p.last_updated ?? '')
    return (
      <a key={p.id} href={`/#event/${p.id}`} className="inline-flex shrink-0 items-center gap-2 px-6 text-sm hover:underline">
        <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
        <span className="font-medium">{p.road_summary?.road_name ?? p.event_type}</span>
        <span className="text-kumo-subtle">
          {[p.road_summary?.locality, p.event_subtype ?? p.event_type].filter(Boolean).join(' · ')}
          {updated && <> · <RelativeTime at={updated} now={now} inline /></>}
        </span>
      </a>
    )
  })
  return (
    <div className="overflow-hidden rounded-xl bg-kumo-base py-3 ring ring-kumo-line" aria-label="Latest road events">
      {/* Rendered twice so the strip loops without a gap; the copy is hidden from screen readers. */}
      <div className="ticker-track flex w-max" style={{ animationDuration: `${events.length * 6}s` }}>
        <div className="flex">{items}</div>
        <div className="flex" aria-hidden inert>
          {items}
        </div>
      </div>
    </div>
  )
}
