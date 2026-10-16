const clock = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', minute: '2-digit' })

/**
 * What to say when a feed's latest read failed: that it is unavailable when
 * nothing has been read, or that the list shown is the last one read. Null
 * while the feed is fine. A failed feed must never look like an empty one.
 */
export function feedNotice(label: string, hasData: boolean, error: string | null, fetchedAt: number | null = null): string | null {
  if (!error) return null
  if (!hasData) return `${label} unavailable: ${error}.`
  return `${label} couldn't be refreshed: ${error}. Showing the list read${fetchedAt != null ? ` at ${clock.format(fetchedAt)}` : ' earlier'}.`
}

/** A gauge source whose read failed, or "all" when every source failed. */
export interface GaugeFailure {
  source: string
  error: string
}

/**
 * The same for the two gauge feeds: when one fails, the other's gauges are
 * still shown, so the notice names the missing publisher.
 */
export function gaugeNotice(hasData: boolean, failed: GaugeFailure[], fetchedAt: number | null): string | null {
  if (!failed.length) return null
  if (failed[0].source === 'all') return feedNotice('Gauges', hasData, failed[0].error, fetchedAt)
  return failed.map((f) => `${f.source} gauges unavailable: ${f.error}.`).join(' ') + ' Showing the others.'
}
