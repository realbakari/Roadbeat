// The small Markdown subset the static pages are written in, and where each
// page's Markdown twin lives.
export const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

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

/** The Markdown file for a request path, for `Accept: text/markdown`: "/" → "/index.md", "/about/" → "/about.md". */
export function markdownPathFor(path: string) {
  const clean = path.replace(/\/+$/, '').replace(/\.html$/, '') || '/'
  return clean === '/' ? '/index.md' : `${clean}.md`
}
