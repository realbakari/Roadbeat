import type { TrafficEvent } from '../api/types'
import { clean } from '../lib/format'
import { eventLocalities, type Locality } from '../lib/locality'

interface Props {
  event: TrafficEvent
  /** The gazetteer index, or null while it loads, when places show as plain text. */
  index: Map<string, Locality[]> | null
  onOpenHref: (hash: string) => void
}

/**
 * An event's places as QLDTraffic names them ("Desailly / Mount Carbine ·
 * Far North"), each that the gazetteer has linking to its place page. Links
 * sit above a card's stretched button, so they open the place, not the event.
 */
export function EventPlace({ event, index, onOpenHref }: Props) {
  const r = event.properties.road_summary
  const district = clean(r?.district)
  const places = index ? eventLocalities(index, clean(r?.locality), r?.local_government_area) : (clean(r?.locality)?.split(' / ').map((name) => ({ name, locality: null })) ?? [])
  return (
    <>
      {places.map((p, i) => (
        <span key={p.name}>
          {i > 0 && ' / '}
          {p.locality ? (
            <a
              href={`#place/locality/${encodeURIComponent(p.locality.name)}`}
              onClick={(e) => (e.preventDefault(), onOpenHref(`place/locality/${encodeURIComponent(p.locality!.name)}`))}
              className="relative z-10 underline underline-offset-2 hover:text-kumo-strong"
            >
              {p.name}
            </a>
          ) : (
            p.name
          )}
        </span>
      ))}
      {places.length > 0 && district && ' · '}
      {district}
    </>
  )
}
