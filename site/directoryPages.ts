// Turns the directory model (site/directory.ts) into pages: one per station,
// line and locality, plus an index page for each kind. Each page is written
// as the Markdown subset site/plugin.ts renders, so it becomes both an HTML
// page and a .md page. The pages carry only published facts; anything live
// (departures, delays, what is happening at a place now) is in the app, and
// the pages say so rather than baking a figure into static HTML.
import type { Directory } from './directory.ts'
import type { StaticPage } from './pageKit.ts'
import { linesIndex, placesIndex, stationsIndex } from './directoryIndexes.ts'
import { linePage } from './linePage.ts'
import { placePage } from './placePage.ts'
import { stationPage } from './stationPage.ts'

export { lineTitle, type Crumb, type StaticPage } from './pageKit.ts'

/** Every directory page: three index pages, then a page per station, line and locality. */
export function directoryPages(d: Directory): StaticPage[] {
  return [stationsIndex(d), linesIndex(d), placesIndex(d), ...d.stations.map((s) => stationPage(s, d)), ...d.lines.map((l) => linePage(l, d)), ...d.places.map((p) => placePage(p, d))]
}
