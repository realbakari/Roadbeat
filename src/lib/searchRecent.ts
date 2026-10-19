import type { SearchHit } from './search'
import { storedList } from './storedList'

// The last few results someone opened from the header search, kept in this
// browser only, so the search opens on them next time.

export const RECENT_MAX = 6

/** The list with `hit` first, without an older copy of it, capped at RECENT_MAX. */
export function withRecent(list: SearchHit[], hit: SearchHit): SearchHit[] {
  return [hit, ...list.filter((h) => h.href !== hit.href)].slice(0, RECENT_MAX)
}

const isHit = (x: unknown): x is SearchHit => {
  const h = x as SearchHit | null
  return !!h && typeof h.href === 'string' && typeof h.title === 'string' && typeof h.detail === 'string' && typeof h.kind === 'string'
}

const store = storedList<SearchHit>('qldt-recent-searches', isHit)
export const useRecentSearches = store.use
export const rememberSearch = (hit: SearchHit) => store.write(withRecent(store.read(), hit))
export const clearRecentSearches = () => store.write([])

/** The title split into runs, marking the words that a query word begins, for highlighting. */
export function matchRuns(title: string, queryWords: string[]): { text: string; match: boolean }[] {
  if (!queryWords.length) return [{ text: title, match: false }]
  const runs: { text: string; match: boolean }[] = []
  // Words of letters and digits, and the separators between them, in order.
  for (const part of title.split(/([\p{L}\p{N}]+)/u)) {
    if (!part) continue
    const plain = part.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const q = queryWords.find((w) => plain.startsWith(w))
    if (q && /[\p{L}\p{N}]/u.test(part)) {
      // Only the matched beginning is marked, so "Good" shows in "Goodna".
      runs.push({ text: part.slice(0, q.length), match: true })
      if (part.length > q.length) runs.push({ text: part.slice(q.length), match: false })
    } else runs.push({ text: part, match: false })
  }
  return runs
}
