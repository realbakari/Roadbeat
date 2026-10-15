// Shared helpers for the scripts that build src/data from TransLink's published GTFS.
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

export const FEEDS = {
  SEQ: 'https://gtfsrt.api.translink.com.au/GTFS/SEQ_GTFS.zip',
  CNS: 'https://gtfsrt.api.translink.com.au/GTFS/CNS_GTFS.zip',
}
export const MODES = { 0: 'tram', 2: 'train', 3: 'bus', 4: 'ferry' }

const dir = mkdtempSync(join(tmpdir(), 'translink-'))

export async function download(url, name) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  const path = join(dir, name)
  writeFileSync(path, Buffer.from(await res.arrayBuffer()))
  return path
}

export const unzip = (zip, entry) =>
  execFileSync('unzip', ['-p', zip, entry], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8')

export function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [head, ...body] = rows.filter((r) => r.length > 1)
  const keys = head.map((h) => h.replace(/^﻿/, ''))
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])))
}

/**
 * Streams a large, unquoted GTFS file (stop_times.txt is ~200 MB) row by row
 * without holding it in memory. Calls `onRow` with an object per row.
 */
export async function eachRow(zip, entry, onRow) {
  const child = spawn('unzip', ['-p', zip, entry])
  let keys = null
  for await (const line of createInterface({ input: child.stdout, crlfDelay: Infinity })) {
    if (!line) continue
    const cells = line.split(',')
    if (!keys) keys = cells.map((h) => h.replace(/^﻿/, ''))
    else onRow(Object.fromEntries(keys.map((k, i) => [k, cells[i] ?? ''])))
  }
}
