// The HTML shell of every static page: the trust pages, the 404 page and
// every directory page.
import { SUPPORT_URL } from '../src/lib/support.ts'
import type { Crumb, StaticPage } from './directoryPages.ts'
import { fullTitle, headTags, pageJsonLd } from './head.ts'
import { escape, markdownToHtml } from './markdown.ts'
import { SITE, type SiteSettings } from './settings.ts'

type Page = StaticPage

const DARK = 'color-scheme:dark;--bg:#111;--fg:#e5e7eb;--sub:#9ca3af;--line:#262626;--link:#7aa2ff'

// Light or dark follows the app's own choice (data-mode, set by MODE_SCRIPT) and otherwise the system's.
const STYLE = `
:root{color-scheme:light dark;--bg:#fff;--fg:#1f2937;--sub:#6b7280;--line:#e5e7eb;--link:#2563eb;--brand:${SITE.themeColor}}
:root[data-mode=light]{color-scheme:light}:root[data-mode=dark]{${DARK}}
@media (prefers-color-scheme:dark){:root:not([data-mode=light]){${DARK}}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header,main,footer{max-width:44rem;margin:0 auto;padding:0 16px}
header{display:flex;align-items:center;gap:10px;padding-top:20px;padding-bottom:12px;border-bottom:1px solid var(--line)}
header a{display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none;font-weight:600;font-size:16px}
header img{width:28px;height:28px}main{padding-top:8px;padding-bottom:32px}
h1,h2{font-weight:600}h1{font-size:24px;line-height:1.25;margin:20px 0 8px}h2{font-size:16px;margin:24px 0 6px}p,ul{margin:6px 0}ul{padding-left:20px}li{margin:3px 0}
a{color:var(--link)}code{font-size:.9em}footer{border-top:1px solid var(--line);padding-top:12px;padding-bottom:28px;color:var(--sub)}
footer nav{display:flex;flex-wrap:wrap;gap:4px 16px}footer a{color:var(--sub)}
nav.crumbs{margin:14px 0 -10px;color:var(--sub)}nav.crumbs ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px}nav.crumbs li+li::before{content:"›";margin-right:4px}
a.open{display:inline-block;margin:12px 0 4px;padding:10px 16px;border-radius:8px;background:var(--brand);color:#fff;font-weight:600;text-decoration:none}a.open:hover{filter:brightness(1.1)}`

/** Applies the light or dark mode chosen in the app (index.html does the same), so the pages match it. */
const MODE_SCRIPT = `<script>try{var m=localStorage.getItem('qldt-mode');if(m==='light'||m==='dark')document.documentElement.dataset.mode=m}catch(e){}</script>`

const FOOTER = `<footer><nav><a href="/">Open the app</a><a href="/stations/">Stations</a><a href="/lines/">Lines</a><a href="/places/">Places</a><a href="/about/">About</a><a href="/privacy/">Privacy</a><a href="/contact/">Contact</a><a href="/llms.txt">For AI agents</a><a href="${SUPPORT_URL}" rel="noopener">Buy me a coffee</a></nav><p>Roadbeat is independent and not affiliated with the Queensland Government. Data from official publishers, most under CC BY 4.0: see <a href="/about/#where-the-data-comes-from">About</a> for every source and its terms. Map data © OpenStreetMap contributors.</p></footer>`

function crumbsNav(crumbs: Crumb[]) {
  if (crumbs.length < 2) return ''
  const items = crumbs.map((c, i) => (i === crumbs.length - 1 ? `<li aria-current="page">${escape(c.name)}</li>` : `<li><a href="${c.path}">${escape(c.name)}</a></li>`))
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.join('')}</ol></nav>\n`
}

/** A full static HTML page: the trust pages, the 404 page and every directory page. */
export function pageHtml(page: Page, s: SiteSettings) {
  const open = page.open ? `\n<p><a class="open" href="/#${page.open.hash}">${escape(page.open.label)}</a></p>` : ''
  // The app button goes under the first paragraph, so it is on the first screen on a phone,
  // and again at the end, after the lists.
  const body = markdownToHtml(page.markdown)
  const intro = body.indexOf('</p>') + '</p>'.length
  const content = open && intro > 3 ? `${body.slice(0, intro)}${open}${body.slice(intro)}${open}` : `${body}${open}`
  return `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escape(fullTitle(page))}</title>
    ${headTags(page, s)}
    <script type="application/ld+json">${JSON.stringify(pageJsonLd(page, s))}</script>
    ${MODE_SCRIPT}
    <style>${STYLE}</style>
  </head>
  <body>
    <header><a href="/"><img src="/favicon.svg" alt="" />${SITE.name}</a></header>
    <main>
${crumbsNav(page.crumbs)}${content}
    </main>
    ${FOOTER}
  </body>
</html>
`
}
