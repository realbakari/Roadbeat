/**
 * The feeds the Queensland news monitor reads. Official sources are kept apart
 * from news outlets everywhere they are shown. Feeds marked `qldOnly` cover all
 * of Australia or the world, so only their Queensland items are kept (see
 * `isQueenslandItem()` in src/lib/newsText.ts).
 *
 * 9News publishes no RSS feed, and The Courier-Mail and Gold Coast Bulletin
 * feeds return empty bodies, so none of them is here (see docs/data-sources.md).
 */

export type SourceKind = 'news' | 'official'

export interface NewsSource {
  id: string
  /** The publisher, as shown in "Reported by". ABC's two feeds share one, so a story they both carry counts once. */
  publisher: string
  kind: SourceKind
  format: 'rss' | 'bom-amoc' | 'ga-quakes'
  url: string
  qldOnly: boolean
  /**
   * How much of the feed's summary to keep: the first sentence for news outlets,
   * whose terms allow headlines and links; the whole summary for an openly
   * licensed source such as Queensland Police (CC BY 4.0).
   */
  summary: 'first-sentence' | 'whole'
}

export const NEWS_SOURCES: NewsSource[] = [
  { id: 'abc-qld', publisher: 'ABC', kind: 'news', format: 'rss', url: 'https://www.abc.net.au/news/feed/50990/rss.xml', qldOnly: false, summary: 'first-sentence' },
  { id: 'abc-brisbane', publisher: 'ABC', kind: 'news', format: 'rss', url: 'https://www.abc.net.au/news/feed/13787262/rss.xml', qldOnly: false, summary: 'first-sentence' },
  { id: 'abc-justin', publisher: 'ABC', kind: 'news', format: 'rss', url: 'https://www.abc.net.au/news/feed/51120/rss.xml', qldOnly: true, summary: 'first-sentence' },
  { id: '7news-qld', publisher: '7NEWS', kind: 'news', format: 'rss', url: 'https://7news.com.au/news/qld/feed', qldOnly: false, summary: 'first-sentence' },
  { id: '7news-brisbane', publisher: '7NEWS', kind: 'news', format: 'rss', url: 'https://7news.com.au/news/brisbane/feed', qldOnly: false, summary: 'first-sentence' },
  // Brisbane Times' only feed is its national and world front page.
  { id: 'brisbane-times', publisher: 'Brisbane Times', kind: 'news', format: 'rss', url: 'https://www.brisbanetimes.com.au/rss/feed.xml', qldOnly: true, summary: 'first-sentence' },
  { id: 'guardian-au', publisher: 'Guardian Australia', kind: 'news', format: 'rss', url: 'https://www.theguardian.com/australia-news/rss', qldOnly: true, summary: 'first-sentence' },
  { id: 'sbs', publisher: 'SBS News', kind: 'news', format: 'rss', url: 'https://www.sbs.com.au/news/topic/latest/feed', qldOnly: true, summary: 'first-sentence' },
  { id: 'qps', publisher: 'Queensland Police', kind: 'official', format: 'rss', url: 'https://mypolice.qld.gov.au/feed/', qldOnly: false, summary: 'whole' },
  // The BoM's HTTP warning feed refuses non-browser requests (403); its anonymous FTP server carries each warning's AMOC metadata.
  // Off unless NEWS_BOM_WARNINGS=on, because of the BoM's terms (see api/_lib/newsIngest.ts).
  { id: 'bom', publisher: 'Bureau of Meteorology', kind: 'official', format: 'bom-amoc', url: 'ftp://ftp.bom.gov.au/anon/gen/fwo/', qldOnly: false, summary: 'first-sentence' },
  {
    id: 'ga-quakes',
    publisher: 'Geoscience Australia',
    kind: 'official',
    format: 'ga-quakes',
    url: "https://earthquakes.ga.gov.au/geoserver/earthquakes/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=earthquakes:earthquakes_seven_days&outputFormat=application/json&CQL_FILTER=located_in_australia='Y'",
    qldOnly: false,
    summary: 'first-sentence',
  },
]

/** Where the app sends readers for BoM warnings: the BoM's own page lists every current Queensland warning in full. */
export const BOM_WARNINGS_PAGE = 'https://www.bom.gov.au/location/australia/queensland/warnings'

/**
 * Each publisher's own square site icon, loaded from the publisher's site, the
 * way feed readers credit a source. A publisher missing here, or an icon that
 * fails to load, shows Roadbeat's generic news or agency mark instead.
 */
export const PUBLISHER_ICONS: Record<string, string> = {
  ABC: 'https://www.abc.net.au/news-assets/touchicon-abc.png',
  '7NEWS': 'https://7news.com.au/static/favicons/apple-touch-icon.png',
  'Brisbane Times': 'https://www.brisbanetimes.com.au/apple-touch-icons/brisbanetimes-2023.png',
  'Guardian Australia': 'https://assets.guim.co.uk/static/frontend/icons/homescreen/apple-touch-icon-240.png',
  'SBS News': 'https://www.sbs.com.au/apple-touch-icon.png',
  'Queensland Police': 'https://mypolice.qld.gov.au/apple-touch-icon.png',
  'Bureau of Meteorology': 'https://www.bom.gov.au/apple-touch-icon.png',
  'Geoscience Australia': 'https://www.ga.gov.au/designs/images/GA_logo_180x180.png',
}
