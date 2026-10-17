import type { Selection } from './route'

/** The tab title for each kind of #place/<kind>/<id> page; any other kind is 'Place'. */
const PLACE_TITLE: Record<string, string> = {
  rest: 'Rest area',
  truck: 'Truck restriction',
  dump: 'RV dump point',
  air: 'Air quality station',
  hotspot: 'Satellite hotspot',
  nswfire: 'NSW fire',
  cyclone: 'Tropical cyclone (JTWC)',
  pastcyclone: 'Past cyclone',
}

/** The site's own title, as the built page sets it, kept for the home view. */
export const SITE_TITLE = 'Roadbeat'

/**
 * What the browser tab should say for the open view, so history, bookmarks,
 * shared links and screen readers name the page rather than the whole app.
 * `names` are the open items' own names where the app has loaded them.
 */
export function pageTitle(
  sel: Selection,
  names: { event?: string | null; locality?: string | null; fire?: string | null; stop?: string | null },
  baseTitle: string,
): string {
  const of = (name: string) => `${name} · ${SITE_TITLE}`
  if (sel.event != null) return of(names.event ?? `Road event ${sel.event}`)
  if (sel.locality) return of(names.locality ?? sel.locality)
  if (sel.fire) return of(names.fire ?? 'Bushfire warning')
  if (sel.camera) return of('Traffic camera')
  if (sel.gauge) return of('Stream gauge')
  if (sel.signal) return of('Traffic signal')
  if (sel.vehicle) return of('Live vehicle')
  if (sel.place) return of(PLACE_TITLE[sel.place.kind] ?? 'Place')
  if (sel.news != null) return of(sel.news ? 'News report' : 'Queensland news')
  const t = sel.transit
  if (t) {
    if (t.kind === 'line') return of(t.name)
    if (t.kind === 'route') return of(`Route ${t.code}`)
    if (t.kind === 'stop') return of(names.stop ?? 'Stop')
    if (t.kind === 'alert') return of('Service alert')
    if (t.kind === 'trip') return of('Trip')
    return of(t.plan ? 'Journey planner' : 'Public transport')
  }
  return baseTitle
}
