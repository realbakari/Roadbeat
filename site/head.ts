// Everything in a page's <head> besides its title: meta tags, links, Open
// Graph and social card tags, and JSON-LD.
import type { Crumb, StaticPage } from './directoryPages.ts'
import { escape, markdownPathFor } from './markdown.ts'
import { NOT_FOUND_PATH, SITE, type SiteSettings } from './settings.ts'

type Page = StaticPage

/** Google's gtag.js snippet for a GA4 measurement ID. */
function googleTag(id: string) {
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
    <script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${id}');</script>`
}

/** The page's full title: its own title, then the brand (the home title already starts with it). */
export const fullTitle = (page: Page) => (page.path === '/' ? page.title : `${page.title} · ${SITE.name}`)

/** Meta tags shared by every page: description, canonical, Open Graph and social card. */
export function headTags(page: Page, s: SiteSettings) {
  const url = s.siteUrl ? `${s.siteUrl}${page.path}` : ''
  const image = s.siteUrl ? `${s.siteUrl}/og-image.jpg` : '/og-image.jpg'
  const title = escape(fullTitle(page))
  return [
    `<meta name="description" content="${escape(page.description)}" />`,
    url && !page.noindex ? `<link rel="canonical" href="${url}" />` : '',
    page.noindex ? '<meta name="robots" content="noindex" />' : '',
    `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${SITE.canvas.light}" />`,
    `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${SITE.canvas.dark}" />`,
    // For clients that ask for /favicon.ico or can't draw SVG icons.
    '<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
    '<link rel="manifest" href="/manifest.webmanifest" />',
    // iPhone and iPad read these when the site is added to the Home Screen.
    `<meta name="apple-mobile-web-app-title" content="${SITE.name}" />`,
    '<meta name="mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
    `<link rel="alternate" type="text/markdown" href="${markdownPathFor(page.path)}" />`,
    `<meta property="og:site_name" content="${SITE.name}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="${SITE.locale}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${escape(page.description)}" />`,
    url && page.path !== NOT_FOUND_PATH ? `<meta property="og:url" content="${url}" />` : '',
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${escape(SITE.imageAlt)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${escape(page.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<meta name="twitter:image:alt" content="${escape(SITE.imageAlt)}" />`,
    s.gaMeasurementId ? googleTag(s.gaMeasurementId) : '',
  ]
    .filter(Boolean)
    .join('\n    ')
}

/** A page's breadcrumb trail as schema.org's BreadcrumbList, with absolute links when the site address is known. */
export function breadcrumbList(crumbs: Crumb[], s: SiteSettings) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, ...(s.siteUrl ? { item: `${s.siteUrl}${c.path}` } : {}) })),
  }
}

/** A trail of one crumb is just the home page, which is no trail at all. */
const trail = (crumbs: Crumb[], s: SiteSettings) => (crumbs.length > 1 ? [breadcrumbList(crumbs, s)] : [])

/**
 * JSON-LD for a directory or trust page: its breadcrumbs and whatever the page
 * describes (a station, a place), tied to the page's address when it is known.
 */
export function pageJsonLd(page: Page, s: SiteSettings) {
  const url = `${s.siteUrl}${page.path}`
  const things = (page.jsonLd ?? []).map((thing) => (s.siteUrl ? { '@id': `${url}#place`, url, ...thing } : thing))
  return { '@context': 'https://schema.org', '@graph': [...trail(page.crumbs, s), ...things] }
}

/** JSON-LD for the home page: the site, the app itself and the project behind it. */
/**
 * A JSON-LD script element. JSON.stringify leaves "<" alone, so a name holding
 * "</script>" would end the element early; as \u003c it reads the same to a parser.
 */
export const jsonLdScript = (graph: unknown) => `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`

export function jsonLd(page: Page, s: SiteSettings) {
  // Written once, and referred to by its @id everywhere else.
  const orgRef = { '@id': `${s.siteUrl}/#org` }
  const org = {
    ...orgRef,
    '@type': 'Organization',
    name: SITE.name,
    ...(s.siteUrl ? { url: s.siteUrl, logo: `${s.siteUrl}/icon-512.png` } : {}),
    ...(s.contactEmail ? { contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: s.contactEmail, areaServed: 'AU-QLD' } } : {}),
  }
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: SITE.name,
        ...(s.siteUrl ? { url: `${s.siteUrl}/` } : {}),
        inLanguage: 'en-AU',
        publisher: orgRef,
      },
      ...trail(page.crumbs, s),
      {
        '@type': 'WebApplication',
        name: SITE.name,
        description: page.description,
        ...(s.siteUrl ? { url: `${s.siteUrl}/` } : {}),
        applicationCategory: 'TravelApplication',
        operatingSystem: 'Any (web browser)',
        browserRequirements: 'Requires JavaScript and a modern browser.',
        inLanguage: 'en-AU',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD' },
        areaServed: { '@type': 'State', name: 'Queensland', containedInPlace: { '@type': 'Country', name: 'Australia' } },
        featureList: [
          'Live Queensland road events and closures',
          'Traffic and flood cameras',
          'Live Translink vehicles, departures and published timetables',
          'Journey planner from the published timetable',
          'Queensland Fire Department bushfire warnings and satellite hotspots',
          'Brisbane City Council and Queensland Government stream gauges',
          'Air quality, Energex power outages and council notices',
          'Commute push alerts',
        ],
        image: s.siteUrl ? `${s.siteUrl}/og-image.jpg` : '/og-image.jpg',
        publisher: orgRef,
      },
      org,
    ],
  }
}
