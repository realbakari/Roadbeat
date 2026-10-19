import type { FireWarning } from '../api/bushfireFeed'
import { nswHazardHeading, type NswHazard } from '../api/nswHazards'
import type { QldWarning } from '../api/qldWarnings'
import type { TransitAlert } from '../api/translink'
import type { TrafficEvent } from '../api/types'
import { brisbaneDayDateTime } from './aest'
import { eventPlace, eventTitle, impactLine } from './eventText'
import { clean } from './format'

// What a shared item says before its link, for pasting into a community group
// or a message: the publisher's own words, who published them and when. Never
// a summary of Roadbeat's own, so a share carries official facts.

const at = (t: number) => `${brisbaneDayDateTime.format(t)} AEST`

/** Runs of spaces collapsed, as feeds sometimes publish them ("Roma   Condamine Road"), so a post reads cleanly. */
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim()

/** "Road closed to all traffic · Both directions: Roma Condamine Road, Warkon · South West. QLDTraffic, updated Mon, 19 Oct, 1:34 pm AEST." */
export function eventShareText(e: TrafficEvent): string {
  const p = e.properties
  const place = eventPlace(e)
  const updated = p.last_updated && Number.isFinite(Date.parse(p.last_updated)) ? `, updated ${at(Date.parse(p.last_updated))}` : ''
  const what = impactLine(e) ?? [p.event_type, clean(p.event_subtype)].filter(Boolean).join(', ')
  return tidy(`${what}: ${eventTitle(e)}${place ? `, ${place}` : ''}. QLDTraffic${updated}.`)
}

/** "Advice: Archer River and surrounding areas. Queensland Fire Department, issued Mon, 19 Oct, 11:58 am AEST." */
export function fireShareText(f: FireWarning): string {
  return tidy(`${f.levelText}: ${f.area ?? f.title}. Queensland Fire Department${f.issued ? `, issued ${at(f.issued)}` : ''}.`)
}

/** "Watch and Act: Condamine. Prepare to leave. Queensland Disaster Management, Issued at 10:00am, Friday 16 October 2026." */
export function warningShareText(w: QldWarning): string {
  const action = w.callToAction ? ` ${w.callToAction.replace(/\.?$/, '.')}` : ''
  return tidy(`${w.levelText}: ${w.area ?? w.title}.${action} ${w.from ?? 'Queensland Disaster Management'}${w.issued ? `, ${w.issued}` : ''}.`)
}

/** "Breakdown · Truck: M1 Pacific Motorway, Tweed Heads West. Transport for NSW, updated Mon, 19 Oct, 3:22 pm AEST." */
export function nswHazardShareText(h: NswHazard): string {
  const road = h.roads[0]
  const where = road ? `: ${[road.street, road.suburb].filter(Boolean).join(', ')}` : ''
  return tidy(`${nswHazardHeading(h)}${where}. Transport for NSW${h.lastUpdated ? `, updated ${at(h.lastUpdated)}` : ''}.`)
}

/** "Lift outage at Central station. Translink." */
export function transitAlertShareText(a: TransitAlert): string {
  return tidy(`${a.header.replace(/\.?$/, '.')} Translink.`)
}
