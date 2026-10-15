/**
 * Parses simple CSV (no quoted fields, as Brisbane's open data exports send for
 * numeric datasets) into rows keyed by header. Strips a leading byte-order mark.
 */
export function parseSimpleCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean)
  const [head, ...body] = lines
  if (!head) return []
  const keys = head.split(',')
  return body.map((line) => {
    const cells = line.split(',')
    return Object.fromEntries(keys.map((k, i) => [k, cells[i] ?? '']))
  })
}
