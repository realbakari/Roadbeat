// Vite plugin for Roadbeat's search-engine and AI-agent surface. Each page in
// site/pages/*.md is written once and becomes:
//  - /<page>/index.html  a static HTML page (/ gets the content inside #root,
//                        so it's readable without JavaScript)
//  - /<page>.md          the same page as Markdown, for agents that ask for it
// It also writes robots.txt, sitemap.xml, llms.txt and manifest.webmanifest,
// and adds the meta tags and JSON-LD to index.html.
//
// Two settings come from the environment or .env files:
//   SITE_URL       the live site's address, e.g. https://www.roadbeat.app.
//                  Canonical links, Open Graph URLs and the sitemap need it;
//                  without it they're left out.
//   CONTACT_EMAIL  shown on the Contact page and in the JSON-LD contact point.
import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { mcpCard, openApi } from './agents.ts'
import { loadDirectory } from './directory.ts'
import { directoryPages, type Crumb, type StaticPage } from './directoryPages.ts'
import { headTags, jsonLd } from './head.ts'
import { manifest } from './manifest.ts'
import { escape, markdownPathFor, markdownToHtml } from './markdown.ts'
import { pageHtml } from './pageHtml.ts'
import { NOT_FOUND_PATH, SITE, type SiteSettings } from './settings.ts'
import { robots, sitemapFiles } from './sitemap.ts'

const PAGES = ['index', 'about', 'glossary', 'privacy', 'contact', '404'] as const
type PageName = (typeof PAGES)[number]

type Page = StaticPage

const CRUMBS: Record<PageName, Crumb[]> = {
  index: [{ name: SITE.name, path: '/' }],
  about: [{ name: SITE.name, path: '/' }, { name: 'About', path: '/about/' }],
  glossary: [{ name: SITE.name, path: '/' }, { name: 'Glossary', path: '/glossary/' }],
  privacy: [{ name: SITE.name, path: '/' }, { name: 'Privacy', path: '/privacy/' }],
  contact: [{ name: SITE.name, path: '/' }, { name: 'Contact', path: '/contact/' }],
  '404': [{ name: SITE.name, path: '/' }],
}

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')
const pagePath = (name: PageName) => (name === 'index' ? '/' : name === '404' ? NOT_FOUND_PATH : `/${name}/`)

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
    '/manifest.webmanifest': { body: manifest(loadPage('index', s).description), type: 'application/manifest+json' },
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
