import { describe, expect, it } from 'vitest'
import { fillTemplate, jsonLd, loadPage, markdownPathFor, markdownToHtml, siteFiles, sitemapFiles } from './plugin.ts'

const withUrl = { siteUrl: 'https://roadbeat.example', contactEmail: 'hello@roadbeat.example', gaMeasurementId: 'G-TEST123' }
const bare = { siteUrl: '', contactEmail: '', gaMeasurementId: '' }

describe('fillTemplate', () => {
  it('keeps or drops conditional blocks and fills placeholders', () => {
    const t = '<!--if:CONTACT_EMAIL-->\nMail %CONTACT_EMAIL%.\n<!--endif-->\n<!--ifnot:CONTACT_EMAIL-->\nSoon.\n<!--endif-->\n'
    expect(fillTemplate(t, { CONTACT_EMAIL: 'a@b.c' })).toBe('Mail a@b.c.\n')
    expect(fillTemplate(t, { CONTACT_EMAIL: '' })).toBe('Soon.\n')
  })
})

describe('markdownToHtml', () => {
  it('converts headings, paragraphs, lists, links and bold, escaping HTML', () => {
    expect(markdownToHtml('# Title\n\nSome **bold** <b>text</b>.\n\n- [About](/about/)\n- Two')).toBe(
      '<h1>Title</h1>\n<p>Some <strong>bold</strong> &lt;b&gt;text&lt;/b&gt;.</p>\n<ul>\n<li><a href="/about/">About</a></li>\n<li>Two</li>\n</ul>',
    )
  })
})

describe('markdownPathFor', () => {
  it('maps page paths to their Markdown files', () => {
    expect(markdownPathFor('/')).toBe('/index.md')
    expect(markdownPathFor('/about/')).toBe('/about.md')
    expect(markdownPathFor('/privacy')).toBe('/privacy.md')
    expect(markdownPathFor('/404.html')).toBe('/404.md')
    expect(markdownPathFor('/stations/central-station/')).toBe('/stations/central-station.md')
  })
})

describe('siteFiles', () => {
  it('writes the sitemap and canonical links only when the site address is known', () => {
    expect(siteFiles(withUrl)['/sitemap.xml'].body).toContain('<loc>https://roadbeat.example/about/</loc>')
    expect(siteFiles(withUrl)['/about/index.html'].body).toContain('<link rel="canonical" href="https://roadbeat.example/about/" />')
    expect(siteFiles(bare)['/sitemap.xml']).toBeUndefined()
    expect(siteFiles(bare)['/about/index.html'].body).not.toContain('rel="canonical"')
  })

  it('adds the Google tag and says so on the Privacy page only when analytics is set', () => {
    expect(siteFiles(withUrl)['/about/index.html'].body).toContain('gtag/js?id=G-TEST123')
    expect(loadPage('privacy', withUrl).markdown).toContain('Google Analytics')
    expect(siteFiles(bare)['/about/index.html'].body).not.toContain('gtag')
    expect(loadPage('privacy', bare).markdown).toContain('without identifying you')
    expect(loadPage('privacy', bare).markdown).not.toContain('Google Analytics')
  })

  it('gives every trust page at least 500 characters of content', () => {
    for (const name of ['about', 'privacy', 'contact'] as const) expect(loadPage(name, bare).markdown.length).toBeGreaterThan(500)
  })

  it('marks the 404 page noindex and leaves it out of the sitemap', () => {
    expect(siteFiles(withUrl)['/404.html'].body).toContain('noindex')
    expect(siteFiles(withUrl)['/sitemap.xml'].body).not.toContain('/404')
    expect(siteFiles(withUrl)['/404.md']).toBeDefined()
  })
})

const tiny = [
  { path: '/stations/', title: 'Stations', description: 'All stations.', markdown: '# Stations\n', crumbs: [{ name: 'Roadbeat', path: '/' }, { name: 'Stations', path: '/stations/' }] },
  {
    path: '/stations/central-station/',
    title: 'Central station',
    description: 'Central.',
    markdown: '# Central station\n',
    crumbs: [{ name: 'Roadbeat', path: '/' }, { name: 'Stations', path: '/stations/' }, { name: 'Central station', path: '/stations/central-station/' }],
    open: { hash: 'transit/stop/SEQ/place_censta', label: 'Open Central station in Roadbeat' },
    jsonLd: [{ '@type': 'TrainStation', name: 'Central station' }],
  },
]

describe('directory pages', () => {
  it('renders each page with breadcrumbs, its JSON-LD, an app button and a Markdown twin, and lists it in the sitemap', () => {
    const files = siteFiles(withUrl, tiny)
    const html = files['/stations/central-station/index.html'].body
    expect(html).toContain('<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Roadbeat</a></li><li><a href="/stations/">Stations</a></li><li aria-current="page">Central station</li></ol></nav>')
    expect(html).toContain('<a class="open" href="/#transit/stop/SEQ/place_censta">Open Central station in Roadbeat</a>')
    expect(html).toContain('"@type":"BreadcrumbList"')
    expect(html).toContain('"@type":"TrainStation"')
    expect(html).toContain('<link rel="canonical" href="https://roadbeat.example/stations/central-station/" />')
    expect(html).toContain('<link rel="alternate" type="text/markdown" href="/stations/central-station.md" />')
    expect(files['/stations/central-station.md'].body).toContain('Open in Roadbeat: https://roadbeat.example/#transit/stop/SEQ/place_censta')
    expect(files['/sitemap.xml'].body).toContain('<loc>https://roadbeat.example/stations/central-station/</loc>')
  })

  it('builds every station, line and place page from the repo data', () => {
    const files = siteFiles(withUrl)
    expect(files['/stations/central-station/index.html'].body).toContain('<a href="/lines/t1-caboolture/">T1 Caboolture</a>')
    expect(files['/lines/t1-caboolture/index.html'].body).toContain('/stations/central-station/')
    expect(files['/places/goodna/index.html'].body).toContain('/stations/goodna-station/')
    expect(Object.keys(files).filter((k) => k.startsWith('/places/')).length).toBeGreaterThan(3000)
  })
})

describe('sitemapFiles', () => {
  it('writes one sitemap up to the limit and a sitemap index of parts above it', () => {
    const paths = ['/', '/a/', '/b/', '/c/']
    expect(Object.keys(sitemapFiles(withUrl, paths, 4))).toEqual(['/sitemap.xml'])
    const split = sitemapFiles(withUrl, paths, 3)
    expect(Object.keys(split).sort()).toEqual(['/sitemap-1.xml', '/sitemap-2.xml', '/sitemap.xml'])
    expect(split['/sitemap.xml']).toContain('<sitemapindex')
    expect(split['/sitemap.xml']).toContain('<loc>https://roadbeat.example/sitemap-2.xml</loc>')
    expect(split['/sitemap-2.xml']).toContain('<loc>https://roadbeat.example/c/</loc>')
    expect(split['/sitemap-2.xml']).not.toContain('/b/')
  })
})

describe('jsonLd', () => {
  it('describes a free web app, adding a contact point only when an email is set', () => {
    const page = loadPage('index', withUrl)
    const graph = jsonLd(page, withUrl)['@graph']
    const of = (type: string) => graph.find((g) => g['@type'] === type)
    expect(of('WebApplication')).toMatchObject({ name: 'Roadbeat', isAccessibleForFree: true, url: 'https://roadbeat.example/' })
    expect(JSON.stringify(of('Organization'))).toContain('hello@roadbeat.example')
    expect(JSON.stringify(jsonLd(page, bare))).not.toContain('contactPoint')
  })

  it('names the site, with a search action that opens a locality page, and a breadcrumb trail', () => {
    const graph = jsonLd(loadPage('index', withUrl), withUrl)['@graph']
    expect(graph[0]).toMatchObject({ '@type': 'WebSite', url: 'https://roadbeat.example/' })
    expect(JSON.stringify(graph[0])).toContain('https://roadbeat.example/#place/locality/{search_term_string}')
    expect(graph[1]).toMatchObject({ '@type': 'BreadcrumbList', itemListElement: [{ position: 1, name: 'Roadbeat', item: 'https://roadbeat.example/' }] })
    expect(JSON.stringify(jsonLd(loadPage('index', bare), bare))).not.toContain('search_term_string')
  })
})
