// Vite plugin for Roadbeat's search-engine and AI-agent surface. Each page in
// site/pages/*.md is written once and becomes:
//  - /<page>/index.html  a static HTML page (/ gets the content inside #root,
//                        so it's readable without JavaScript)
//  - /<page>.md          the same page as Markdown, for agents that ask for it
// It also writes robots.txt, sitemap.xml, llms.txt and manifest.webmanifest,
// and adds the meta tags and JSON-LD to index.html.
//
// Two settings come from the environment or .env files:
//   SITE_URL       the live site's address, e.g. https://roadbeat.com.au.
//                  Canonical links, Open Graph URLs and the sitemap need it;
//                  without it they're left out.
//   CONTACT_EMAIL  shown on the Contact page and in the JSON-LD contact point.
import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { mcpCard, openApi } from './agents.ts'
import { loadDirectory } from './directory.ts'
import { directoryPages, type Crumb, type StaticPage } from './directoryPages.ts'
import { SUPPORT_URL } from '../src/lib/support.ts'

export const SITE = {
  name: 'Roadbeat',
  tagline: 'Live Queensland roads and transport',
  themeColor: '#7a1f3d',
  locale: 'en_AU',
}

const PAGES = ['index', 'about', 'privacy', 'contact', '404'] as const
type PageName = (typeof PAGES)[number]

export interface SiteSettings {
  siteUrl: string
  contactEmail: string
  /** Google Analytics 4 measurement ID, such as G-XXXXXXX. Empty for no analytics. */
  gaMeasurementId: string
}

type Page = StaticPage

const CRUMBS: Record<PageName, Crumb[]> = {
  index: [{ name: SITE.name, path: '/' }],
  about: [{ name: SITE.name, path: '/' }, { name: 'About', path: '/about/' }],
  privacy: [{ name: SITE.name, path: '/' }, { name: 'Privacy', path: '/privacy/' }],
  contact: [{ name: SITE.name, path: '/' }, { name: 'Contact', path: '/contact/' }],
  '404': [{ name: SITE.name, path: '/' }],
}

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')
const pagePath = (name: PageName) => (name === 'index' ? '/' : name === '404' ? '/404.html' : `/${name}/`)

/** Resolves `<!--if:VAR-->…<!--endif-->` and `<!--ifnot:VAR-->…<!--endif-->` blocks, then `%VAR%` placeholders. */
export function fillTemplate(text: string, vars: Record<string, string>) {
  return text
    .replace(/<!--(if|ifnot):([A-Z_]+)-->\n?([\s\S]*?)<!--endif-->\n?/g, (_, kind: string, key: string, body: string) =>
      (kind === 'if') === Boolean(vars[key]) ? body : '',
    )
    .replace(/%([A-Z_]+)%/g, (whole, key: string) => (key in vars ? vars[key] : whole))
}

function vars(s: SiteSettings) {
  return { SITE_URL: s.siteUrl, CONTACT_EMAIL: s.contactEmail, GA_MEASUREMENT_ID: s.gaMeasurementId }
}

export function loadPage(name: PageName, s: SiteSettings): Page {
  const raw = fillTemplate(read(`./pages/${name}.md`), vars(s))
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  const meta = Object.fromEntries((match?.[1] ?? '').split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]))
  return { path: pagePath(name), title: meta.title ?? SITE.name, description: meta.description ?? '', markdown: (match?.[2] ?? raw).trim() + '\n', crumbs: CRUMBS[name], noindex: name === '404' }
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function inline(text: string) {
  return escape(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
}

/** Converts the small Markdown subset the pages use: headings, paragraphs, bullet lists, links, bold and code. */
export function markdownToHtml(md: string) {
  const out: string[] = []
  let list = false
  let para: string[] = []
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`)
    para = []
  }
  for (const line of md.split('\n')) {
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    const item = line.match(/^-\s+(.*)$/)
    if (heading || item || !line.trim()) flush()
    if (!item && list) {
      out.push('</ul>')
      list = false
    }
    if (heading) out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`)
    else if (item) {
      if (!list) out.push('<ul>')
      list = true
      out.push(`<li>${inline(item[1])}</li>`)
    } else if (line.trim()) para.push(line.trim())
  }
  flush()
  if (list) out.push('</ul>')
  return out.join('\n')
}

/** Google's gtag.js snippet for a GA4 measurement ID. */
function googleTag(id: string) {
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
    <script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${id}');</script>`
}

/** Meta tags shared by every page: description, canonical, Open Graph and social card. */
function headTags(page: Page, s: SiteSettings) {
  const url = s.siteUrl ? `${s.siteUrl}${page.path}` : ''
  const image = s.siteUrl ? `${s.siteUrl}/og-image.jpg` : '/og-image.jpg'
  return [
    `<meta name="description" content="${escape(page.description)}" />`,
    url && !page.noindex ? `<link rel="canonical" href="${url}" />` : '',
    page.noindex ? '<meta name="robots" content="noindex" />' : '',
    `<meta name="theme-color" content="${SITE.themeColor}" />`,
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
    `<meta property="og:title" content="${escape(page.title)}" />`,
    `<meta property="og:description" content="${escape(page.description)}" />`,
    url ? `<meta property="og:url" content="${url}" />` : '',
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${SITE.name}: ${SITE.tagline}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escape(page.title)}" />`,
    `<meta name="twitter:description" content="${escape(page.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
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

/** JSON-LD for a directory or trust page: its breadcrumbs and whatever the page describes (a station, a place). */
export function pageJsonLd(page: Page, s: SiteSettings) {
  return { '@context': 'https://schema.org', '@graph': [breadcrumbList(page.crumbs, s), ...(page.jsonLd ?? [])] }
}

/** JSON-LD for the home page: the site, the app itself and the project behind it. */
export function jsonLd(page: Page, s: SiteSettings) {
  const org = {
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
        publisher: org,
        // The app opens any Queensland locality's page by name (#place/locality/<name>).
        ...(s.siteUrl
          ? {
              potentialAction: {
                '@type': 'SearchAction',
                target: { '@type': 'EntryPoint', urlTemplate: `${s.siteUrl}/#place/locality/{search_term_string}` },
                'query-input': 'required name=search_term_string',
              },
            }
          : {}),
      },
      breadcrumbList(page.crumbs, s),
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
          'Live TransLink vehicles, departures and published timetables',
          'Journey planner from the published timetable',
          'Queensland Fire Department bushfire warnings',
          'Brisbane City Council stream gauges and traffic signal volumes',
        ],
        image: s.siteUrl ? `${s.siteUrl}/og-image.jpg` : '/og-image.jpg',
        publisher: org,
      },
      org,
    ],
  }
}

const STYLE = `
:root{color-scheme:light dark;--bg:#fff;--fg:#1f2937;--sub:#6b7280;--line:#e5e7eb;--link:#2563eb;--brand:${SITE.themeColor}}
@media (prefers-color-scheme:dark){:root{--bg:#111;--fg:#e5e7eb;--sub:#9ca3af;--line:#262626;--link:#7aa2ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header,main,footer{max-width:44rem;margin:0 auto;padding:0 16px}
header{display:flex;align-items:center;gap:10px;padding-top:20px;padding-bottom:12px;border-bottom:1px solid var(--line)}
header a{display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none;font-weight:600;font-size:16px}
header img{width:28px;height:28px}main{padding-top:8px;padding-bottom:32px}
h1{font-size:24px;line-height:1.25;margin:20px 0 8px}h2{font-size:16px;margin:24px 0 6px}p,ul{margin:6px 0}ul{padding-left:20px}li{margin:3px 0}
a{color:var(--link)}code{font-size:.9em}footer{border-top:1px solid var(--line);padding-top:12px;padding-bottom:28px;color:var(--sub)}
footer nav{display:flex;flex-wrap:wrap;gap:4px 16px}footer a{color:var(--sub)}
nav.crumbs{margin:14px 0 -10px;color:var(--sub)}nav.crumbs ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px}nav.crumbs li+li::before{content:"›";margin-right:4px}
a.open{display:inline-block;margin:12px 0 4px;padding:10px 16px;border-radius:8px;background:var(--brand);color:#fff;font-weight:600;text-decoration:none}a.open:hover{filter:brightness(1.1)}`

const FOOTER = `<footer><nav><a href="/">Open the app</a><a href="/stations/">Stations</a><a href="/lines/">Lines</a><a href="/places/">Places</a><a href="/about/">About</a><a href="/privacy/">Privacy</a><a href="/contact/">Contact</a><a href="/llms.txt">For AI agents</a><a href="${SUPPORT_URL}" rel="noopener">Buy me a coffee</a></nav><p>Roadbeat is independent and not affiliated with the Queensland Government. Data © State of Queensland and Brisbane City Council, CC BY 4.0.</p></footer>`

function crumbsNav(crumbs: Crumb[]) {
  if (crumbs.length < 2) return ''
  const items = crumbs.map((c, i) => (i === crumbs.length - 1 ? `<li aria-current="page">${escape(c.name)}</li>` : `<li><a href="${c.path}">${escape(c.name)}</a></li>`))
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.join('')}</ol></nav>\n`
}

/** A full static HTML page: the trust pages, the 404 page and every directory page. */
export function pageHtml(page: Page, s: SiteSettings) {
  const open = page.open ? `\n<p><a class="open" href="/#${page.open.hash}">${escape(page.open.label)}</a></p>` : ''
  return `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escape(page.title)} · ${SITE.name}</title>
    ${headTags(page, s)}
    <script type="application/ld+json">${JSON.stringify(pageJsonLd(page, s))}</script>
    <style>${STYLE}</style>
  </head>
  <body>
    <header><a href="/"><img src="/favicon.svg" alt="" />${SITE.name}</a></header>
    <main>
${crumbsNav(page.crumbs)}${markdownToHtml(page.markdown)}${open}
    </main>
    ${FOOTER}
  </body>
</html>
`
}

function robots(s: SiteSettings) {
  return `# ${SITE.name}: every page may be crawled, by search engines and AI agents alike.
User-agent: *
Allow: /
Disallow: /translink-rt/
Disallow: /qfd-bushfires
Disallow: /api/
Disallow: /mcp
${s.siteUrl ? `\nSitemap: ${s.siteUrl}/sitemap.xml\n` : ''}`
}

/** The sitemap protocol's limit on URLs per file. */
export const SITEMAP_LIMIT = 50_000

const XML = '<?xml version="1.0" encoding="UTF-8"?>\n'
const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'

/**
 * sitemap.xml listing every indexable page. Over `limit` URLs, sitemap.xml
 * becomes a sitemap index of sitemap-1.xml, sitemap-2.xml and so on.
 */
export function sitemapFiles(s: SiteSettings, paths: string[], limit = SITEMAP_LIMIT): Record<string, string> {
  const today = new Date().toISOString().slice(0, 10)
  const urlset = (list: string[]) => `${XML}<urlset ${NS}>\n${list.map((p) => `  <url><loc>${s.siteUrl}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`
  if (paths.length <= limit) return { '/sitemap.xml': urlset(paths) }
  const files: Record<string, string> = {}
  const parts: string[] = []
  for (let i = 0; i * limit < paths.length; i++) {
    files[`/sitemap-${i + 1}.xml`] = urlset(paths.slice(i * limit, (i + 1) * limit))
    parts.push(`  <sitemap><loc>${s.siteUrl}/sitemap-${i + 1}.xml</loc><lastmod>${today}</lastmod></sitemap>`)
  }
  files['/sitemap.xml'] = `${XML}<sitemapindex ${NS}>\n${parts.join('\n')}\n</sitemapindex>\n`
  return files
}

function manifest() {
  return JSON.stringify(
    {
      name: `${SITE.name}: ${SITE.tagline}`,
      id: '/',
      short_name: SITE.name,
      description: 'Live Queensland road conditions, cameras, public transport, timetables and bushfire warnings from official sources.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: SITE.themeColor,
      lang: 'en-AU',
      categories: ['travel', 'navigation', 'utilities'],
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      ],
    },
    null,
    2,
  )
}

export type SiteFiles = Record<string, { body: string; type: string }>

/**
 * Every generated file, keyed by its URL path: the trust pages, the directory
 * pages (`directory`, by default the one built from the repo's data), their
 * Markdown twins, the sitemap and the agent files.
 */
export function siteFiles(s: SiteSettings, directory: StaticPage[] = directoryPages(loadDirectory())): SiteFiles {
  const files: SiteFiles = {
    '/robots.txt': { body: robots(s), type: 'text/plain; charset=utf-8' },
    '/llms.txt': { body: fillTemplate(read('./llms.txt'), vars(s)), type: 'text/plain; charset=utf-8' },
    '/manifest.webmanifest': { body: manifest(), type: 'application/manifest+json' },
    '/openapi.json': { body: JSON.stringify(openApi(s.siteUrl), null, 2), type: 'application/json' },
    '/.well-known/mcp.json': { body: JSON.stringify(mcpCard(s.siteUrl), null, 2), type: 'application/json' },
  }
  const pages = [...PAGES.map((name) => loadPage(name, s)), ...directory]
  for (const page of pages) {
    const markdown = page.open ? `${page.markdown}\n\nOpen in Roadbeat: ${s.siteUrl}/#${page.open.hash}\n` : page.markdown
    files[markdownPathFor(page.path)] = { body: markdown, type: 'text/markdown; charset=utf-8' }
    if (page.path === '/') continue
    files[page.path.endsWith('/') ? `${page.path}index.html` : page.path] = { body: pageHtml(page, s), type: 'text/html; charset=utf-8' }
  }
  if (s.siteUrl) {
    const indexable = pages.filter((p) => !p.noindex).map((p) => p.path)
    for (const [path, body] of Object.entries(sitemapFiles(s, indexable))) files[path] = { body, type: 'application/xml; charset=utf-8' }
  }
  return files
}

/** The Markdown file for a request path, for `Accept: text/markdown`: "/" → "/index.md", "/about/" → "/about.md". */
export function markdownPathFor(path: string) {
  const clean = path.replace(/\/+$/, '').replace(/\.html$/, '') || '/'
  return clean === '/' ? '/index.md' : `${clean}.md`
}

export function sitePages(settings: SiteSettings): Plugin {
  if (settings.gaMeasurementId && !/^G-[A-Z0-9]+$/.test(settings.gaMeasurementId))
    throw new Error(`GA_MEASUREMENT_ID must look like G-XXXXXXX, got "${settings.gaMeasurementId}"`)
  const s = { ...settings, siteUrl: settings.siteUrl.replace(/\/+$/, '') }
  // Thousands of directory pages: rendered once per build or dev server, not per request.
  let files: SiteFiles | null = null
  const allFiles = () => (files ??= siteFiles(s))
  return {
    name: 'roadbeat-site-pages',
    transformIndexHtml(html) {
      const home = loadPage('index', s)
      return html
        .replace('<!--site-head-->', `${headTags(home, s)}\n    <script type="application/ld+json">${JSON.stringify(jsonLd(home, s))}</script>`)
        .replace('<!--site-title-->', escape(home.title))
        .replace('<!--site-static-home-->', `<div class="static-home">\n${markdownToHtml(home.markdown)}\n</div>`)
    },
    generateBundle() {
      for (const [path, f] of Object.entries(allFiles())) this.emitFile({ type: 'asset', fileName: path.slice(1), source: f.body })
    },
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const path = (req.url ?? '/').split('?')[0]
        const files = allFiles()
        const wantsMarkdown = (req.headers.accept ?? '').includes('text/markdown')
        const key = wantsMarkdown ? markdownPathFor(path) : files[path] ? path : files[`${path.replace(/\/?$/, '/')}index.html`] ? `${path.replace(/\/?$/, '/')}index.html` : null
        const hit = key ? files[key] : null
        if (!hit) {
          if (wantsMarkdown && path !== '/' && !path.startsWith('/@') && !path.includes('.')) {
            res.statusCode = 404
            res.setHeader('content-type', 'text/markdown; charset=utf-8')
            res.end(files['/404.md'].body)
            return
          }
          return next()
        }
        res.setHeader('content-type', hit.type)
        res.setHeader('vary', 'Accept')
        res.end(hit.body)
      })
    },
  }
}
