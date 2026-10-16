import { describe, expect, it } from 'vitest'
import type { TrafficEvent } from '../api/types'
import { roadEvent } from '../test/fixtures'
import { EMPTY_HISTORY, inEffectAt, prune, recordRun, runAtOrBefore, toHistoryEvent, versionKey } from './eventHistory'

const T0 = Date.parse('2026-10-15T10:00:00+10:00')
const min = (n: number) => T0 + n * 60_000

function event(id: number, over: Partial<TrafficEvent['properties']> = {}, coordinates: [number, number] | null = [153, -27.5]): TrafficEvent {
  const e = roadEvent(id, 'Bruce Highway', 'Caboolture')
  return { ...e, geometry: coordinates ? { type: 'Point', coordinates } : null, properties: { ...e.properties, published: '2026-10-15T09:00:00+10:00', last_updated: '2026-10-15T09:30:00+10:00', ...over } }
}

describe('versionKey and toHistoryEvent', () => {
  it('keys a version by id and last_updated, and keeps only the compact fields', () => {
    const e = event(7, { impact: { direction: null, towards: null, impact_type: 'Closures', impact_subtype: null, delay: null } })
    expect(versionKey(e)).toBe(`7@${Date.parse('2026-10-15T09:30:00+10:00')}`)
    expect(versionKey(event(7, { last_updated: null }))).toBe('7@')
    expect(toHistoryEvent(e)).toEqual({
      id: 7,
      published: Date.parse('2026-10-15T09:00:00+10:00'),
      updated: Date.parse('2026-10-15T09:30:00+10:00'),
      type: 'Crash',
      priority: 'High',
      closure: true,
      anchor: [153, -27.5],
      road: 'Bruce Highway',
    })
    expect(toHistoryEvent(event(8, {}, null)).anchor).toBeNull()
  })
})

describe('recordRun', () => {
  it('records each run and extends the span of an event seen at consecutive runs', () => {
    let h = recordRun(EMPTY_HISTORY, [event(1), event(2)], min(0), '2026-10-15T09:59:30+10:00')
    h = recordRun(h, [event(1)], min(5))
    h = recordRun(h, [event(1), event(2)], min(10))
    expect(h.runs).toEqual([
      { at: min(0), published: Date.parse('2026-10-15T09:59:30+10:00'), count: 2 },
      { at: min(5), published: null, count: 1 },
      { at: min(10), published: null, count: 2 },
    ])
    expect(h.events[versionKey(event(1))].spans).toEqual([[min(0), min(10)]])
    expect(h.events[versionKey(event(2))].spans).toEqual([
      [min(0), min(0)],
      [min(10), min(10)],
    ])
  })

  it('keeps a new version when an event is updated, so a replay shows what was published then', () => {
    let h = recordRun(EMPTY_HISTORY, [event(1, { event_priority: 'Low' })], min(0))
    h = recordRun(h, [event(1, { event_priority: 'High', last_updated: '2026-10-15T10:04:00+10:00' })], min(5))
    const versions = Object.values(h.events)
    expect(versions.map((v) => v.priority)).toEqual(['Low', 'High'])
    expect(inEffectAt(h, h.runs[0]).map((v) => v.priority)).toEqual(['Low'])
    expect(inEffectAt(h, h.runs[1]).map((v) => v.priority)).toEqual(['High'])
  })

  it('counts only events in effect: not upcoming roadworks, not events past their end', () => {
    const upcoming = event(3, { event_type: 'Roadworks', duration: { start: '2026-10-20T00:00:00+10:00', end: null, active_days: null, recurrences: null } })
    const ended = event(4, { event_type: 'Hazard', duration: { start: '2026-10-01T00:00:00+10:00', end: '2026-10-10T00:00:00+10:00', active_days: null, recurrences: null } })
    const h = recordRun(EMPTY_HISTORY, [event(1), upcoming, ended], min(0))
    expect(h.runs[0].count).toBe(1)
    expect(Object.keys(h.events)).toEqual([versionKey(event(1))])
  })

  it('ignores a run that is not later than the last one', () => {
    const h = recordRun(EMPTY_HISTORY, [event(1)], min(0))
    expect(recordRun(h, [event(2)], min(0))).toBe(h)
    expect(recordRun(h, [event(2)], min(-5))).toBe(h)
  })
})

describe('prune', () => {
  const limits = { windowMs: 20 * 60_000, maxRuns: 100, maxBytes: 1_000_000 }

  it('drops runs older than the window and clips spans to the oldest run kept', () => {
    let h = EMPTY_HISTORY
    for (const m of [0, 5, 10, 15, 20, 25]) h = recordRun(h, [event(1), ...(m < 10 ? [event(2)] : [])], min(m), null, limits)
    expect(h.runs.map((r) => r.at)).toEqual([min(5), min(10), min(15), min(20), min(25)])
    expect(h.events[versionKey(event(1))].spans).toEqual([[min(5), min(25)]])
    expect(h.events[versionKey(event(2))].spans).toEqual([[min(5), min(5)]])
    h = prune(h, min(35), limits)
    expect(h.runs.map((r) => r.at)).toEqual([min(15), min(20), min(25)])
    expect(h.events[versionKey(event(2))]).toBeUndefined()
  })

  it('caps the number of runs', () => {
    let h = EMPTY_HISTORY
    for (let m = 0; m < 50; m += 5) h = recordRun(h, [event(1)], min(m), null, { ...limits, windowMs: 60 * 60_000, maxRuns: 3 })
    expect(h.runs.map((r) => r.at)).toEqual([min(35), min(40), min(45)])
  })

  it('drops the oldest runs until the record fits its size cap, keeping at least one', () => {
    let h = EMPTY_HISTORY
    for (let m = 0; m < 30; m += 5) h = recordRun(h, [event(m + 10)], min(m), null, { ...limits, windowMs: 60 * 60_000 })
    const small = prune(h, min(30), { ...limits, windowMs: 60 * 60_000, maxBytes: 600 })
    expect(small.runs.length).toBeLessThan(h.runs.length)
    expect(small.runs.length).toBeGreaterThanOrEqual(1)
    expect(Object.keys(small.events).length).toBe(small.runs.length)
    expect(prune(h, min(30), { ...limits, windowMs: 60 * 60_000, maxBytes: 1 }).runs.length).toBe(1)
  })
})

describe('runAtOrBefore', () => {
  it('finds the last run at or before t, never one after it', () => {
    const h = [5, 10, 15].reduce((acc, m) => recordRun(acc, [event(1)], min(m)), EMPTY_HISTORY)
    expect(runAtOrBefore(h.runs, min(12))?.at).toBe(min(10))
    expect(runAtOrBefore(h.runs, min(10))?.at).toBe(min(10))
    expect(runAtOrBefore(h.runs, min(99))?.at).toBe(min(15))
    expect(runAtOrBefore(h.runs, min(4))).toBeNull()
    expect(runAtOrBefore([], min(4))).toBeNull()
  })
})
