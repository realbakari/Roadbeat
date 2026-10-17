// The site's fixed identity and the settings that come from the environment.
export const SITE = {
  name: 'Roadbeat',
  tagline: 'Live Queensland roads and transport',
  themeColor: '#7a1f3d',
  locale: 'en_AU',
}

export interface SiteSettings {
  siteUrl: string
  contactEmail: string
  /** Google Analytics 4 measurement ID, such as G-XXXXXXX. Empty for no analytics. */
  gaMeasurementId: string
}
