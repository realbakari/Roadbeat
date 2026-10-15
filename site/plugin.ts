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

export const SITE = {
  name: 'Roadbeat',
  tagline: 'Live Queensland roads and transport',
  themeColor: '#7a1f3d',
  locale: 'en_AU',
}

const PAGES = ['index', 'about', 'privacy', 'contact', '404'] as const
type PageName = (typeof PAGES)[number]
const INDEXABLE: PageName[] = ['index', 'about', 'privacy', 'contact']

export interface SiteSettings {
  siteUrl: string
  contactEmail: string
}

interface Page {
  name: PageName
  title: string
  description: string
  markdown: string
}

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')

/** Resolves `<!--if:VAR-->…<!--endif-->` and `<!--ifnot:VAR-->…<!--endif-->` blocks, then `%VAR%` placeholders. */
export function fillTemplate(text: string, vars: Record<string, string>) {
  return text
    .replace(/<!--(if|ifnot):([A-Z_]+)-->\n?([\s\S]*?)<!--endif-->\n?/g, (_, kind: string, key: string, body: string) =>
      (kind === 'if') === Boolean(vars[key]) ? body : '',
    )
    .replace(/%([A-Z_]+)%/g, (whole, key: string) => (key in vars ? vars[key] : whole))
}

function vars(s: SiteSettings) {
  return { SITE_URL: s.siteUrl, CONTACT_EMAIL: s.contactEmail }
}

export function loadPage(name: PageName, s: SiteSettings): Page {
  const raw = fillTemplate(read(`./pages/${name}.md`), vars(s))
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  const meta = Object.fromEntries((match?.[1] ?? '').split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]))
  return { name, title: meta.title ?? SITE.name, description: meta.description ?? '', markdown: (match?.[2] ?? raw).trim() + '\n' }
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

const pagePath = (name: PageName) => (name === 'index' ? '/' : `/${name}/`)

/** Meta tags shared by every page: description, canonical, Open Graph and social card. */
function headTags(page: Page, s: SiteSettings) {
  const url = s.siteUrl ? `${s.siteUrl}${pagePath(page.name)}` : ''
  const image = s.siteUrl ? `${s.siteUrl}/og-image.jpg` : '/og-image.jpg'
  return [
    `<meta name="description" content="${escape(page.description)}" />`,
    url && page.name !== '404' ? `<link rel="canonical" href="${url}" />` : '',
    page.name === '404' ? '<meta name="robots" content="noindex" />' : '',
    `<meta name="theme-color" content="${SITE.themeColor}" />`,
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
    '<link rel="manifest" href="/manifest.webmanifest" />',
    '<link rel="alternate" type="text/markdown" href="' + (page.name === 'index' ? '/index.md' : `/${page.name}.md`) + '" />',
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
  ]
    .filter(Boolean)
    .join('\n    ')
}

/** JSON-LD for the home page: the app itself and the project behind it. */
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
footer nav{display:flex;flex-wrap:wrap;gap:4px 16px}footer a{color:var(--sub)}`

const FOOTER = `<footer><nav><a href="/">Open the app</a><a href="/about/">About</a><a href="/privacy/">Privacy</a><a href="/contact/">Contact</a><a href="/llms.txt">For AI agents</a></nav><p>Roadbeat is independent and not affiliated with the Queensland Government. Data © State of Queensland and Brisbane City Council, CC BY 4.0.</p></footer>`

/** A full static HTML page for About, Privacy, Contact and the 404 page. */
export function pageHtml(page: Page, s: SiteSettings) {
  return `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escape(page.title)} · ${SITE.name}</title>
    ${headTags(page, s)}
    <style>${STYLE}</style>
  </head>
  <body>
    <header><a href="/"><img src="/favicon.svg" alt="" />${SITE.name}</a></header>
    <main>
${markdownToHtml(page.markdown)}
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
${s.siteUrl ? `\nSitemap: ${s.siteUrl}/sitemap.xml\n` : ''}`
}

function sitemap(s: SiteSettings) {
  const today = new Date().toISOString().slice(0, 10)
  const urls = INDEXABLE.map((n) => `  <url><loc>${s.siteUrl}${pagePath(n)}</loc><lastmod>${today}</lastmod></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

function manifest() {
  return JSON.stringify(
    {
      name: `${SITE.name}: ${SITE.tagline}`,
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

/** Every generated file, keyed by its URL path. */
export function siteFiles(s: SiteSettings): Record<string, { body: string; type: string }> {
  const files: Record<string, { body: string; type: string }> = {
    '/robots.txt': { body: robots(s), type: 'text/plain; charset=utf-8' },
    '/llms.txt': { body: fillTemplate(read('./llms.txt'), vars(s)), type: 'text/plain; charset=utf-8' },
    '/manifest.webmanifest': { body: manifest(), type: 'application/manifest+json' },
  }
  if (s.siteUrl) files['/sitemap.xml'] = { body: sitemap(s), type: 'application/xml; charset=utf-8' }
  for (const name of PAGES) {
    const page = loadPage(name, s)
    files[`/${name}.md`] = { body: page.markdown, type: 'text/markdown; charset=utf-8' }
    if (name === '404') files['/404.html'] = { body: pageHtml(page, s), type: 'text/html; charset=utf-8' }
    else if (name !== 'index') files[`/${name}/index.html`] = { body: pageHtml(page, s), type: 'text/html; charset=utf-8' }
  }
  return files
}

/** The Markdown file for a request path, for `Accept: text/markdown`: "/" → "/index.md", "/about/" → "/about.md". */
export function markdownPathFor(path: string) {
  const clean = path.replace(/\/+$/, '') || '/'
  return clean === '/' ? '/index.md' : `${clean}.md`
}

export function sitePages(settings: SiteSettings): Plugin {
  const s = { ...settings, siteUrl: settings.siteUrl.replace(/\/+$/, '') }
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
      for (const [path, f] of Object.entries(siteFiles(s))) this.emitFile({ type: 'asset', fileName: path.slice(1), source: f.body })
    },
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const path = (req.url ?? '/').split('?')[0]
        const files = siteFiles(s)
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
