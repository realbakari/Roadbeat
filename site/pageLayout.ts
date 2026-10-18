// How a static page's rendered Markdown is laid out: its title and lead
// paragraph go in the banner, and its sections get an "On this page" list,
// as the Queensland Government Design System's banner and in-page navigation
// components do.

export interface PageParts {
  /** The h1's inner HTML, or null when the page has none. */
  title: string | null
  /** The paragraph straight after the h1, which introduces the page. */
  lead: string | null
  /** Everything after them. */
  body: string
}

/** Splits the h1 and its first paragraph from the rest, for the banner. */
export function splitLead(html: string): PageParts {
  const m = html.match(/^<h1>(.*?)<\/h1>\n?(?:<p>(.*?)<\/p>\n?)?/s)
  if (!m) return { title: null, lead: null, body: html }
  return { title: m[1], lead: m[2] ?? null, body: html.slice(m[0].length) }
}

/** Fewer sections than this read fine without a list; more than the upper bound is an index, which has its own jump list. */
export const TOC_MIN = 3
export const TOC_MAX = 12

/** The page's second-level headings as an "On this page" list, or '' when there are too few or too many. */
export function inPageNav(body: string): string {
  // Heading text is already escaped by markdownToHtml; only its inline tags (bold, code) are dropped.
  const headings = [...body.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)].map(([, id, text]) => ({ id, text: text.replace(/<[^>]+>/g, '') }))
  if (headings.length < TOC_MIN || headings.length > TOC_MAX) return ''
  const items = headings.map((h) => `<li><a href="#${h.id}">${h.text}</a></li>`)
  return `<nav class="toc" aria-labelledby="on-this-page"><p class="toc-title" id="on-this-page">On this page</p><ul>${items.join('')}</ul></nav>`
}
