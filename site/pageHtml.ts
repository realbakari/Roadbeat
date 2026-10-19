// The HTML shell of every static page: the trust pages, the 404 page and
// every directory page. A skip link, the site header, a banner with the
// breadcrumbs, title and lead, the page's sections with an "On this page"
// list, and a footer of link columns (see site/pageStyle.ts for where the
// layout comes from).
import { SUPPORT_URL } from '../src/lib/support.ts'
import type { Crumb, StaticPage } from './directoryPages.ts'
import { fullTitle, headTags, pageJsonLd } from './head.ts'
import { escape, markdownToHtml } from './markdown.ts'
import { inPageNav, splitLead } from './pageLayout.ts'
import { STYLE } from './pageStyle.ts'
import { SITE, type SiteSettings } from './settings.ts'

type Page = StaticPage

const REPO = 'https://github.com/realbakari/Roadbeat'

/** Applies the light or dark mode chosen in the app (index.html does the same), so the pages match it. */
const MODE_SCRIPT = `<script>try{var m=localStorage.getItem('qldt-mode');if(m==='light'||m==='dark')document.documentElement.dataset.mode=m}catch(e){}</script>`

const HEADER = `<header class="site"><div class="wrap">
      <a class="brand" href="/"><img src="/favicon.svg" alt="" /><span><b>${SITE.name}</b><span>${SITE.tagline}</span></span></a>
      <a class="btn" href="/">Open the app</a>
      <nav aria-label="Main"><ul><li><a href="/places/">Places</a></li><li><a href="/stations/">Stations</a></li><li><a href="/lines/">Lines</a></li><li><a href="/about/">About</a></li></ul></nav>
    </div></header>`

const column = (title: string, links: [string, string, string?][]) =>
  `<div><h2>${title}</h2><ul>${links.map(([label, href, rel]) => `<li><a href="${href}"${rel ? ` rel="${rel}"` : ''}>${label}</a></li>`).join('')}</ul></div>`

const FOOTER = `<footer><div class="wrap">
      <div class="cols">
        ${column('Browse', [['Queensland places', '/places/'], ['Stations and stops', '/stations/'], ['Lines and routes', '/lines/']])}
        ${column('Roadbeat', [['Open the app', '/'], ['About', '/about/'], ['Glossary', '/glossary/'], ['Privacy', '/privacy/'], ['Contact', '/contact/']])}
        ${column('Open source', [['Source code on GitHub', REPO, 'noopener'], ['For AI agents', '/llms.txt'], ['Buy me a coffee', SUPPORT_URL, 'noopener']])}
      </div>
      <p class="fine">Roadbeat is independent and not affiliated with the Queensland Government. Data from official publishers, most under CC BY 4.0: see <a href="/about/#where-the-data-comes-from">About</a> for every source and its terms. Map data © OpenStreetMap contributors. In an emergency, call Triple Zero (000).</p>
      <a class="top" href="#top">Back to top</a>
    </div></footer>`

function crumbsNav(crumbs: Crumb[]) {
  if (crumbs.length < 2) return ''
  const items = crumbs.map((c, i) => (i === crumbs.length - 1 ? `<li aria-current="page">${escape(c.name)}</li>` : `<li><a href="${c.path}">${escape(c.name)}</a></li>`))
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.join('')}</ol></nav>\n`
}

/** A full static HTML page: the trust pages, the 404 page and every directory page. */
export function pageHtml(page: Page, s: SiteSettings) {
  const { title, lead, body } = splitLead(markdownToHtml(page.markdown))
  // The app button sits in the banner, so it is on the first screen on a phone, and again after the lists.
  const open = page.open ? `<a class="open" href="/#${page.open.hash}">${escape(page.open.label)}</a>` : ''
  const toc = inPageNav(body)
  return `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${escape(fullTitle(page))}</title>
    ${headTags(page, s)}
    <script type="application/ld+json">${JSON.stringify(pageJsonLd(page, s))}</script>
    ${MODE_SCRIPT}
    <style>${STYLE}</style>
  </head>
  <body id="top">
    <a class="skip" href="#main">Skip to main content</a>
    ${HEADER}
    <main id="main">
      <div class="banner"><div class="wrap">
${crumbsNav(page.crumbs)}<h1>${title ?? escape(page.title)}</h1>${lead ? `\n<p class="lead">${lead}</p>` : ''}${open ? `\n<p>${open}</p>` : ''}
      </div></div>
      <div class="wrap page${toc ? ' has-toc' : ''}">
${toc}<div class="content">
${body}${open ? `\n<div class="cta"><p>See what's happening there now</p>${open}</div>` : ''}
</div>
      </div>
    </main>
    ${FOOTER}
  </body>
</html>
`
}
