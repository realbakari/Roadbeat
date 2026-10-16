import { describe, expect, it } from 'vitest'
import { fillTemplate, jsonLd, loadPage, markdownPathFor, markdownToHtml, siteFiles } from './plugin.ts'

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
    expect(siteFiles(withUrl)['/sitemap.xml'].body).not.toContain('404')
  })
})

describe('jsonLd', () => {
  it('describes a free web app, adding a contact point only when an email is set', () => {
    const page = loadPage('index', withUrl)
    const graph = jsonLd(page, withUrl)['@graph']
    expect(graph[0]).toMatchObject({ '@type': 'WebApplication', name: 'Roadbeat', isAccessibleForFree: true, url: 'https://roadbeat.example/' })
    expect(JSON.stringify(graph[1])).toContain('hello@roadbeat.example')
    expect(JSON.stringify(jsonLd(page, bare))).not.toContain('contactPoint')
  })
})
