// The small Markdown subset the static pages are written in, and where each
// page's Markdown twin lives.
import { slugify } from './directory.ts'

export const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Link addresses a page may use: the web, email, phone and this site's own paths. Anything else (javascript:, data:) stays text. */
const SAFE_HREF = /^(https?:|mailto:|tel:|\/|#)/i

function inline(text: string) {
  return escape(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, (link, label: string, href: string) => (SAFE_HREF.test(href) ? `<a href="${href}">${label}</a>` : link))
}

/** Kinds of alert a quote can open with, GitHub's way: "> [!WARNING]". */
const ALERTS = { NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important', WARNING: 'Warning' } as const

/**
 * A quoted block as a callout, or as an in-page alert when it opens with
 * "[!NOTE]", "[!WARNING]" and so on. Both stay plain Markdown in the .md twin.
 */
function quote(lines: string[]) {
  const kind = lines[0]?.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING)\]$/)?.[1] as keyof typeof ALERTS | undefined
  const inner = markdownToHtml((kind ? lines.slice(1) : lines).join('\n'))
  return kind
    ? `<div class="alert alert-${kind.toLowerCase()}" role="note"><p class="alert-title">${ALERTS[kind]}</p>\n${inner}\n</div>`
    : `<aside class="callout">\n${inner}\n</aside>`
}

/** A list whose every item is one link and nothing else, set out in columns. */
const isLinkList = (items: string[]) => items.length > 1 && items.every((i) => /^\[[^\]]+\]\([^)]+\)$/.test(i))

/**
 * Converts the small Markdown subset the pages use: headings, paragraphs,
 * bullet lists, quotes, links, bold and code. Second- and third-level headings
 * get an id from their text, so "## Brisbane City" can be linked as
 * #brisbane-city. A list of nothing but links is marked for columns.
 */
export function markdownToHtml(md: string) {
  const out: string[] = []
  let items: string[] = []
  let quoted: string[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`)
    para = []
  }
  const endList = () => {
    if (items.length) out.push(`<ul${isLinkList(items) ? ' class="links"' : ''}>`, ...items.map((i) => `<li>${inline(i)}</li>`), '</ul>')
    items = []
  }
  const endQuote = () => {
    if (quoted.length) out.push(quote(quoted))
    quoted = []
  }
  for (const line of md.split('\n')) {
    const q = line.match(/^>\s?(.*)$/)
    if (q) {
      flush()
      endList()
      quoted.push(q[1])
      continue
    }
    endQuote()
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    const item = line.match(/^-\s+(.*)$/)
    if (heading || item || !line.trim()) flush()
    if (!item) endList()
    if (heading) {
      const level = heading[1].length
      out.push(`<h${level}${level > 1 ? ` id="${slugify(heading[2])}"` : ''}>${inline(heading[2])}</h${level}>`)
    } else if (item) items.push(item[1])
    else if (line.trim()) para.push(line.trim())
  }
  flush()
  endList()
  endQuote()
  return out.join('\n')
}

/** The Markdown file for a request path, for `Accept: text/markdown`: "/" → "/index.md", "/about/" → "/about.md". */
export function markdownPathFor(path: string) {
  const clean = path.replace(/\/+$/, '').replace(/\.html$/, '') || '/'
  return clean === '/' ? '/index.md' : `${clean}.md`
}
