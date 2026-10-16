import { describe, expect, it } from 'vitest'
import type { EventHistory, HistoryEvent } from '../api/historyTypes'
import { gauge, newsItem } from '../test/fixtures'
import { asTrafficEvent, clampTime, countEvents, replayAt, stepTime, TIMELINE_WINDOW_MS } from './timeline'

const T0 = Date.parse('2026-10-15T10:00:00+10:00')
const min = (n: number) => T0 + n * 60_000

const version = (id: number, spans: [number, number][], over: Partial<HistoryEvent> = {}): HistoryEvent => ({
  id,
  published: null,
  updated: null,
  type: 'Crash',
  priority: 'High',
  closure: false,
  anchor: [153, -27.5],
  road: 'Bruce Highway',
  spans,
  ...over,
})

const history: EventHistory = {
  runs: [
    { at: min(0), published: null, count: 2 },
    { at: min(5), published: min(4), count: 1 },
    { at: min(10), published: null, count: 2 },
  ],
  events: {
    '1@': version(1, [[min(0), min(10)]]),
    '2@': version(2, [[min(0), min(0)], [min(10), min(10)]], { type: 'Hazard', closure: true }),
  },
}

describe('replayAt', () => {
  it('shows events as of the nearest run at or before t, never a later or interpolated one', () => {
    const between = replayAt(min(7), history, [], [])
    expect(between.run).toEqual({ at: min(5), published: min(4), count: 1 })
    expect(between.events.map((e) => e.id)).toEqual([1])
    expect(replayAt(min(10), history, [], []).events.map((e) => e.id)).toEqual([1, 2])
    expect(replayAt(min(0), history, [], []).events.map((e) => e.id)).toEqual([1, 2])
  })

  it('has no run, and no events, before the record starts or without a record', () => {
    expect(replayAt(min(-1), history, [], [])).toMatchObject({ run: null, events: [] })
    expect(replayAt(min(5), null, [], [])).toMatchObject({ run: null, events: [] })
  })

  it('keeps only news items dated by t and gauge readings taken by t', () => {
    const items = [newsItem({ id: 'a', published: min(2) }), newsItem({ id: 'b', published: min(8), updated: min(9) })]
    const g = { ...gauge('G1', [153, -27]), readings: [{ time: min(1), value: 1 }, { time: min(6), value: 2 }] }
    const r = replayAt(min(5), history, items, [g])
    expect(r.items.map((i) => i.id)).toEqual(['a'])
    expect(r.gauges[0].readings).toEqual([{ time: min(1), value: 1 }])
    expect(replayAt(min(0), history, items, [g]).gauges[0].readings).toEqual([])
  })
})

describe('asTrafficEvent', () => {
  it('rebuilds an event the map can draw from the recorded fields only', () => {
    const e = asTrafficEvent(version(2, [], { type: 'Hazard', closure: true, published: min(0), updated: min(3) }))
    expect(e.geometry).toEqual({ type: 'Point', coordinates: [153, -27.5] })
    expect(e.properties).toMatchObject({ id: 2, event_type: 'Hazard', event_priority: 'High', published: new Date(min(0)).toISOString(), last_updated: new Date(min(3)).toISOString() })
    expect(e.properties.impact?.impact_type).toBe('Closures')
    expect(e.properties.road_summary?.road_name).toBe('Bruce Highway')
    expect(asTrafficEvent(version(3, [], { anchor: null, road: null })).geometry).toBeNull()
    expect(asTrafficEvent(version(3, [], { anchor: null, road: null })).properties.impact).toBeNull()
  })
})

describe('counts, clamping and stepping', () => {
  it('counts closures and crashes from the record', () => {
    expect(countEvents(Object.values(history.events))).toEqual({ total: 2, closures: 1, crashes: 1 })
  })

  it('keeps a time inside the last 48 hours', () => {
    expect(clampTime(min(5), min(0))).toBe(min(0))
    expect(clampTime(min(-5), min(0))).toBe(min(-5))
    expect(clampTime(0, min(0))).toBe(min(0) - TIMELINE_WINDOW_MS)
  })

  it('steps forward at the speed, and returns to live on reaching now', () => {
    expect(stepTime(min(0), 60_000, 500, min(60))).toBe(min(0) + 30_000)
    expect(stepTime(min(0), 15 * 60_000, 1000, min(60))).toBe(min(15))
    expect(stepTime(min(59), 5 * 60_000, 1000, min(60))).toBeNull()
  })
})
