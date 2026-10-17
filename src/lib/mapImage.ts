// What a saved map image carries, so a screenshot shared without the app still
// says where it came from and when: a footer with the save time in AEST, each
// shown layer's latest data time where Roadbeat knows it, the map credits, and
// what couldn't be drawn into the picture.

const aest = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** "roadbeat-2026-10-18-0052.png", in Queensland time. */
export function imageFileName(now: number): string {
  const parts = Object.fromEntries(stamp.formatToParts(now).map((p) => [p.type, p.value]))
  return `roadbeat-${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}.png`
}

export interface ImageFooter {
  /** "Roadbeat · www.roadbeat.app". */
  title: string
  /** "Saved Sat 18 Oct 2026, 12:52 am AEST". */
  saved: string
  /** One line per shown source with its data time, e.g. "Satellite: Himawari-9, image 12:40 am AEST". */
  sources: string[]
  /** The map's attribution, as its credits control shows it. */
  credits: string
  /** Things on screen that aren't in the picture, said plainly. */
  missing: string[]
}

export interface FooterInput {
  now: number
  siteUrl: string
  sources: string[]
  credits: string
  /** Whether the rain radar is shown: it's an image the browser can't copy, so it's left out. */
  radar: boolean
  /** Whether camera thumbnails are shown over the map: they're page elements, not part of the map. */
  cameraThumbs: boolean
}

export function imageFooter(f: FooterInput): ImageFooter {
  const host = f.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return {
    title: `Roadbeat · ${host}`,
    saved: `Saved ${aest.format(f.now)} AEST. Live data changes: check the app for the latest.`,
    sources: f.sources,
    credits: f.credits.replace(/\s+/g, ' ').trim(),
    missing: [
      ...(f.radar ? ['Rain radar is not in this image (its host does not allow it to be copied).'] : []),
      ...(f.cameraThumbs ? ['Camera thumbnails are not in this image.'] : []),
    ],
  }
}

/** Splits `text` into lines no wider than `max` px, measured by `measure`. */
export function wrapText(text: string, max: number, measure: (s: string) => number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && measure(next) > max) {
      out.push(line)
      line = word
    } else line = next
  }
  if (line) out.push(line)
  return out
}
