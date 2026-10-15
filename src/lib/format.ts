const TZ = 'Australia/Brisbane'

const rtf = new Intl.RelativeTimeFormat('en-AU', { numeric: 'auto' })

const dateTime = new Intl.DateTimeFormat('en-AU', {
  timeZone: TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : dateTime.format(d)
}

export function timeAgo(iso: string | number | null | undefined, now = Date.now()): string | null {
  if (iso == null) return null
  const t = typeof iso === 'number' ? iso : new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const secs = Math.round((t - now) / 1000)
  const abs = Math.abs(secs)
  if (abs < 45) return 'just now'
  if (abs < 3600) return rtf.format(Math.round(secs / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(secs / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(secs / 86400), 'day')
  if (abs < 86400 * 365) return rtf.format(Math.round(secs / (86400 * 30)), 'month')
  return rtf.format(Math.round(secs / (86400 * 365)), 'year')
}

/** Trims whitespace and treats empty / "N/A" strings as missing. */
export function clean(s: string | null | undefined): string | null {
  const t = s?.trim()
  return t && t !== 'N/A' ? t : null
}

/** "BRISBANE CITY" → "Brisbane City" */
export function titleCase(s: string | null | undefined): string | null {
  const t = clean(s)
  if (!t) return null
  if (t !== t.toUpperCase()) return t
  return t.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

const day = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })

/** "2020-10-08" → "8 Oct 2020", for a calendar date with no time of day. */
export function formatDay(ymd: string | null | undefined): string | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const d = new Date(`${ymd}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : day.format(d)
}
