import type { Post, PostSource } from './posts'

// Searching the timeline: the posts that have loaded, matched on the
// publisher's own words. Nothing is looked up anywhere else, so a place that
// no loaded post names finds nothing, and the search says which feeds are in.

/** Everything a post can be found by: its words, place, publisher, reference and full details. */
function haystack(p: Post): string {
  const detail = [...p.detail.facts.map(([, v]) => v), ...p.detail.sections.map((s) => s.text), ...p.detail.reports.map((r) => `${r.publisher} ${r.title} ${r.summary ?? ''}`)]
  return [p.title, p.body, p.place, p.publisher, p.handle, p.kind, p.level, p.ref, ...detail].filter(Boolean).join(' ').toLowerCase()
}

const words = (q: string) =>
  q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}#\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)

/**
 * The posts matching every word of the query, those naming it in their title
 * first, then by latest activity. An empty query matches nothing.
 */
export function searchPosts(posts: Post[], query: string): Post[] {
  const terms = words(query)
  if (!terms.length) return []
  const hits = posts.flatMap((p) => {
    const text = haystack(p)
    if (!terms.every((t) => text.includes(t))) return []
    const title = p.title.toLowerCase()
    return [{ p, inTitle: terms.every((t) => title.includes(t)) }]
  })
  return hits.sort((a, b) => Number(b.inTitle) - Number(a.inTitle) || b.p.latest - a.p.latest).map((h) => h.p)
}

/** The order and headings results are grouped under. */
export const SEARCH_GROUPS: { source: PostSource; label: string }[] = [
  { source: 'warning', label: 'Hazard warnings' },
  { source: 'fire', label: 'Bushfires' },
  { source: 'road', label: 'Road events' },
  { source: 'transit', label: 'Translink alerts' },
  { source: 'news', label: 'News and notices' },
]

/** Results grouped by source, in SEARCH_GROUPS' order, each group keeping the search's order; at most `limit` per group. */
export function groupResults(results: Post[], limit = 8): { label: string; posts: Post[]; more: number }[] {
  return SEARCH_GROUPS.flatMap(({ source, label }) => {
    const all = results.filter((p) => p.source === source)
    return all.length ? [{ label, posts: all.slice(0, limit), more: all.length - Math.min(all.length, limit) }] : []
  })
}
