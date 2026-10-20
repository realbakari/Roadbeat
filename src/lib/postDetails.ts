import { fireKindLabel, type FireWarning } from '../api/bushfires'
import type { QldWarning } from '../api/qldWarnings'
import type { TransitAlert } from '../api/translink'
import type { TrafficEvent } from '../api/types'
import { brisbaneDayDateTime } from './aest'
import { impactLine } from './eventText'
import { clean } from './format'
import type { NewsStory } from './newsStories'

// What a timeline post's own page shows beyond the card: every field the
// publisher filled in, word for word, under the publisher's own headings, with
// each time in Queensland time. A field the publisher left out is left out.

/** A post's full details. */
export interface PostDetail {
  /** Short published facts, label and value. */
  facts: [string, string][]
  /** The publisher's longer text, each under its heading, word for word. */
  sections: { title: string; text: string }[]
  /** Every report of a news story, newest first, as far as each outlet's licence lets Roadbeat show it. */
  reports: { publisher: string; title: string; summary: string | null; link: string; at: number }[]
}

const stamp = (t: number) => `${brisbaneDayDateTime.format(t)} AEST`
const msOf = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}
const timeOf = (iso: string | null | undefined) => {
  const t = msOf(iso)
  return t == null ? null : stamp(t)
}

/** Keeps the rows with a value. */
const rows = (...r: [string, string | null | undefined][]): [string, string][] => r.flatMap(([k, v]) => (v ? [[k, v] as [string, string]] : []))
const parts = (...p: [string, string | null | undefined][]) => p.flatMap(([title, text]) => (text ? [{ title, text }] : []))

export function roadDetail(e: TrafficEvent): PostDetail {
  const p = e.properties
  const r = p.road_summary
  return {
    facts: rows(
      ['Road', clean(r?.road_name)],
      ['Locality', clean(r?.locality)],
      ['Council area', clean(r?.local_government_area)],
      ['District', clean(r?.district)],
      ['Impact', impactLine(e)],
      ['Starts', timeOf(p.duration?.start)],
      ['Ends', timeOf(p.duration?.end)],
      ['Active days', p.duration?.active_days?.length ? p.duration.active_days.join(', ') : null],
      ['Status', clean(p.status)],
      ['Provided by', clean(p.source?.provided_by)],
      ['Published', timeOf(p.published)],
      ['Last updated', timeOf(p.last_updated)],
      ['Next inspection', timeOf(p.next_inspection)],
    ),
    sections: parts(['Description', clean(p.description)], ['Advice', clean(p.advice)], ['More information', clean(p.information)]),
    reports: [],
  }
}

export function fireDetail(f: FireWarning): PostDetail {
  return {
    facts: rows(
      ['Level', f.levelText],
      ['Kind', fireKindLabel(f)],
      ['Status', f.status],
      ['Location', f.location],
      ['Area', f.area],
      ['Issued', f.issued == null ? null : stamp(f.issued)],
      ['In the feed since', f.published == null ? null : stamp(f.published)],
      ['Expires', f.expires == null ? null : stamp(f.expires)],
    ),
    sections: parts(
      ['What to do now', f.callToAction],
      ['Summary', f.header],
      ['Impacts', f.impacts],
      ['What you should do', f.shouldDo],
      ['Leaving safely', f.leaveSafely],
      ['More information', f.further],
      ['Details', f.text],
    ),
    reports: [],
  }
}

export function warningDetail(w: QldWarning): PostDetail {
  return {
    facts: rows(['Level', w.levelText], ['Type', w.type], ['Area', w.area], ['Issued by', w.from], ['Issued', w.issued], ['Next update', w.nextUpdate]),
    sections: parts(['What to do now', w.callToAction], ['Summary', w.header], ['Impacts', w.impacts], ['What you should do', w.shouldDo], ['More information', w.moreInformation]),
    reports: [],
  }
}

export function transitDetail(a: TransitAlert): PostDetail {
  const periods = a.periods
    .map((p) => [p.start == null ? 'Until further notice' : stamp(p.start), p.end == null ? 'until further notice' : stamp(p.end)].join(' to '))
    .join('; ')
  return {
    facts: rows(
      ['Effect', a.effect],
      ['Cause', a.cause],
      ['Routes', a.routes.length ? a.routes.join(', ') : null],
      ['Stops named', a.stops ? String(a.stops) : null],
      ['In effect', periods || null],
      ['Region', a.region],
    ),
    sections: parts(['Details', clean(a.description)]),
    reports: [],
  }
}

export function newsDetail(s: NewsStory): PostDetail {
  return {
    facts: rows(['Places named', s.places.length ? s.places.map((p) => p.name).join(', ') : null], ['Publishers', s.publishers.join(', ')]),
    sections: [],
    reports: s.items.map((i) => ({ publisher: i.publisher, title: i.title, summary: i.summary, link: i.link, at: i.updated ?? i.published })),
  }
}
