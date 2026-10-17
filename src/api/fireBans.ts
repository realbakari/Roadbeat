import { decodeEntities } from '../lib/newsText'

// The Queensland Fire Department's fire ban feed (an Atom feed made by FME,
// published to the same public bucket as its bushfire incidents). It sends no
// CORS headers, so the app reads it through /qfd-firebans (vercel.json,
// vite.config.ts, functions/qfd-firebans.ts). Each entry's text is shown as
// QFD writes it, including "No current fire bans."

export const FIRE_BANS_URL: string = import.meta.env.VITE_QFD_FIREBANS_URL ?? '/qfd-firebans'
export const FIRE_BANS_PAGE = 'https://www.fire.qld.gov.au/safety-education/using-fire-outdoors/fire-bans-and-restrictions'

export interface FireBan {
  id: string
  /** The entry's text as QFD publishes it. */
  text: string
  /** When QFD last updated the entry, ms since the epoch. */
  updatedAt: number | null
}

export interface FireBans {
  bans: FireBan[]
  /** True when the only entry says there are no current bans. */
  none: boolean
  /** When QFD generated the feed, ms since the epoch. */
  feedUpdatedAt: number | null
}

const tag = (xml: string, name: string) => {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`).exec(xml)
  return m ? decodeEntities(m[1].replace(/<!\[CDATA\[|\]\]>/g, '')).trim() : null
}

const time = (s: string | null) => {
  const t = s ? Date.parse(s) : NaN
  return Number.isFinite(t) ? t : null
}

/**
 * Entries in the order QFD lists them. The feed's own <title> per entry is an
 * internal "Updated 2026…" stamp, so the text comes from <content> (or
 * <summary>), and the time from <updated>, which carries its zone.
 */
export function parseFireBans(xml: string): FireBans {
  const head = xml.split('<entry')[0]
  const bans = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)].flatMap(([, body], i) => {
    const text = tag(body, 'content') ?? tag(body, 'summary')
    if (!text) return []
    return [{ id: tag(body, 'id') ?? String(i), text: text.replace(/\s+/g, ' '), updatedAt: time(tag(body, 'updated')) }]
  })
  const none = bans.length === 1 && /^no current fire bans\.?$/i.test(bans[0].text)
  return { bans, none, feedUpdatedAt: time(tag(head, 'updated')) }
}

export async function fetchFireBans(signal?: AbortSignal): Promise<FireBans> {
  const res = await fetch(FIRE_BANS_URL, { signal })
  if (!res.ok) throw new Error(`The fire ban feed responded with ${res.status}`)
  if ((res.headers.get('content-type') ?? '').includes('text/html')) throw new Error('The fire ban feed proxy is not configured')
  return parseFireBans(await res.text())
}
