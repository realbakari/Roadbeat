import type { TrafficEvent } from '../api/types.js'
import { eventPlace, eventTitle } from './eventText.js'
import { clean } from './format.js'

// Link previews (Slack, WhatsApp, iMessage, Facebook, X) never send the part
// of a URL after #, so a shared #event/… link unfurls as the home page. A road
// event is shared as /api/share?event=<id> instead: a tiny page whose preview
// tags carry that event's official text, which sends people on to the app.

const DESCRIPTION_MAX = 200

/** The link to share for an app hash, or null when the hash has no share page (it is shared as it is). */
export function shareUrl(origin: string, hash: string): string | null {
  const m = /^#?event\/(\d+)$/.exec(hash)
  return m ? `${origin}/api/share?event=${m[1]}` : null
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function shorten(s: string, max: number) {
  return s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`
}

/**
 * The share page for a road event: QLDTraffic's own road name, type and
 * description in the title and preview tags, and an immediate redirect to the
 * event in the app. `event` is null when QLDTraffic no longer lists it.
 */
export function eventSharePage(origin: string, id: number, event: TrafficEvent | null): string {
  const target = `${origin}/#event/${id}`
  const p = event?.properties
  const title = event ? `${eventTitle(event)}: ${p?.event_subtype ? clean(p.event_subtype) : p?.event_type} · Roadbeat` : 'Road event · Roadbeat'
  const description = event
    ? shorten([eventPlace(event), clean(p?.description)].filter(Boolean).join('. '), DESCRIPTION_MAX)
    : 'This road event is no longer listed by QLDTraffic. Open Roadbeat for what is happening now.'
  const url = `${origin}/api/share?event=${id}`
  const tags = [
    ['og:type', 'website'],
    ['og:site_name', 'Roadbeat'],
    ['og:title', title],
    ['og:description', description],
    ['og:url', url],
    ['og:image', `${origin}/og-image.jpg`],
    ['twitter:card', 'summary_large_image'],
  ]
    .map(([k, v]) => `<meta ${k.startsWith('og:') ? 'property' : 'name'}="${k}" content="${escapeHtml(v)}">`)
    .join('\n')
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="noindex">
${tags}
<meta http-equiv="refresh" content="0; url=${escapeHtml(target)}">
</head>
<body>
<p><a href="${escapeHtml(target)}">Open this road event in Roadbeat</a></p>
</body>
</html>
`
}
