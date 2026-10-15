// Text handling for news feed items: plain text from RSS markup, the first
// sentence of a summary, and the Queensland filter for national feeds.

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' }

/** Decodes the HTML entities RSS feeds use: named, decimal and hex. Unknown names are left as written. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? m
    const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m
  })
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, ' ')

/**
 * Markup to plain text: tags dropped, entities decoded, whitespace collapsed.
 * Some feeds (The Guardian's) escape their HTML as entities, so tags are
 * dropped again after decoding.
 */
export function plainText(s: string): string {
  return stripTags(decodeEntities(stripTags(s)))
    .replace(/\s+/g, ' ')
    .trim()
}

// Words that end with a full stop without ending the sentence.
const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'mt', 'jr', 'sr', 'no', 'rd', 'ave', 'hwy', 'pde', 'tce', 'cres', 'det', 'sgt', 'snr', 'const', 'insp', 'supt', 'prof', 'gov', 'sen', 'hon', 'vs'])
const MAX_SUMMARY = 280

/**
 * The first sentence of a summary, the most the monitor keeps from an article.
 * Truncation marks some feeds add (`[…]`) are removed; a first sentence longer
 * than 280 characters is cut at a word and ends with "…".
 */
export function firstSentence(raw: string): string | null {
  const text = plainText(raw).replace(/\s*\[(…|\.\.\.|&hellip;)\]\s*$/, '')
  if (!text) return null
  const re = /[.!?](?=["'’”)]?\s+["'‘“(]?[A-Z0-9])/g
  let end = text.length
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const word = /([A-Za-z.]+)$/.exec(text.slice(0, m.index))?.[1] ?? ''
    // "Mt. Isa", "J. Smith" and "a.m." don't end a sentence.
    if (m[0] === '.' && (ABBREVIATIONS.has(word.toLowerCase()) || /^[A-Z]$/.test(word) || word.includes('.'))) continue
    end = m.index + 1
    break
  }
  const sentence = text.slice(0, end).replace(/^["'‘“]+(?=[^"'’”]*$)/, '').trim()
  if (sentence.length <= MAX_SUMMARY) return sentence
  const cut = sentence.slice(0, MAX_SUMMARY)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : MAX_SUMMARY).replace(/[,;:]$/, '')}…`
}

const MAX_WHOLE_SUMMARY = 700

/**
 * A feed's whole summary as plain text, for sources whose licence allows it.
 * A truncation mark the publisher added (`[…]`) becomes "…", so the text never
 * reads as complete when it isn't. Longer than 700 characters, it is cut at a word.
 */
export function wholeSummary(raw: string): string | null {
  const text = plainText(raw)
  const truncated = /\s*\[(…|\.\.\.)\]\s*$/.test(text)
  const body = text.replace(/\s*\[(…|\.\.\.)\]\s*$/, '')
  if (!body) return null
  if (body.length <= MAX_WHOLE_SUMMARY) return truncated ? `${body}…` : body
  const cut = body.slice(0, MAX_WHOLE_SUMMARY)
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '')}…`
}

const QLD_WORD = /\b(Queensland(ers?)?|QLD|Qld)\b/
const QLD_CATEGORY = /queensland|brisbane/i

/**
 * Whether an item from a national feed is about Queensland: it names Queensland
 * in its headline, summary or link, or the publisher filed it under Queensland
 * or Brisbane. Nothing is inferred from place names, because many Queensland
 * place names are also places in other states.
 */
export function isQueenslandItem(item: { title: string; summary: string | null; link: string; categories: string[] }): boolean {
  return (
    QLD_WORD.test(item.title) ||
    QLD_WORD.test(item.summary ?? '') ||
    item.categories.some((c) => QLD_CATEGORY.test(c)) ||
    /[/-](queensland|qld)[/-]/i.test(new URL(item.link).pathname)
  )
}
