import { NewsSnapshot } from './newsTypes'

/** The news monitor's items, from api/news.ts (or the dev server's /api/news). */
export const NEWS_URL: string = import.meta.env.VITE_NEWS_URL ?? '/api/news'

export async function fetchNews(signal?: AbortSignal): Promise<NewsSnapshot> {
  const res = await fetch(NEWS_URL, { signal })
  if (!res.ok) throw new Error(`News monitor responded with ${res.status}`)
  return NewsSnapshot.parse(await res.json())
}
