import type { CrashFilter, Severity } from '../api/crashes'

// The crash history layer's year range and severity choices. The range can't
// run backwards and at least one severity stays chosen, so the layer never
// asks the dataset for nothing.

/**
 * The filter with one end of the year range moved. Moving an end past the
 * other drags the other along, giving a single year. A year that isn't a
 * number leaves the filter as it was.
 */
export function withYear(filter: CrashFilter, end: 'from' | 'to', value: string | null): CrashFilter {
  const y = Number(value)
  if (!y) return filter
  const next = { ...filter, [end]: y }
  if (next.from > next.to) next[end === 'from' ? 'to' : 'from'] = y
  return next
}

/** The filter with one severity switched on or off, unless it's the only one left on. */
export function toggleSeverity(filter: CrashFilter, s: Severity): CrashFilter {
  const has = filter.severities.includes(s)
  if (has && filter.severities.length === 1) return filter
  return { ...filter, severities: has ? filter.severities.filter((x) => x !== s) : [...filter.severities, s] }
}
