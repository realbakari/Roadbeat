// The site's fixed identity and the settings that come from the environment.
export const SITE = {
  name: 'Roadbeat',
  tagline: 'Live Queensland roads and transport',
  themeColor: '#7a1f3d',
  /** The app's page background (Kumo's base colour) in light and dark mode, for the browser's toolbar. */
  canvas: { light: '#ffffff', dark: '#0f0f0f' },
  locale: 'en_AU',
  /** What public/og-image.jpg shows, for people who can't see it. */
  imageAlt: 'The Roadbeat logo, a white tile with a maroon road, above the words Live Queensland roads and transport and the features road events, cameras, live vehicles, timetables, bushfires and flood gauges.',
}

/** Where the 404 page is written; it stands in for every missing address, so it has no URL of its own to share. */
export const NOT_FOUND_PATH = '/404.html'

export interface SiteSettings {
  siteUrl: string
  contactEmail: string
  /** Google Analytics 4 measurement ID, such as G-XXXXXXX. Empty for no analytics. */
  gaMeasurementId: string
}
