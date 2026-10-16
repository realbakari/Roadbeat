import { describe, expect, it } from 'vitest'
import type { Gauge } from '../api/bccGauges'
import { changeWithin, nearbyGauges, rainfallSince, rainfallTotal } from './gauges'

const T = Date.parse('2026-10-15T10:00:00+10:00')
const min = (m: number) => T + m * 60_000
const gauge = (over: Partial<Gauge>): Gauge => ({ id: 'E1', name: 'Gauge', kind: 'stream', source: 'bcc', unit: 'm', position: [153, -27.5], readings: [], ...over })

describe('changeWithin', () => {
  it('compares the earliest and latest readings in the window', () => {
    const g = gauge({ readings: [{ time: min(-90), value: 1 }, { time: min(-50), value: 1.2 }, { time: min(0), value: 1.5 }] })
    const c = changeWithin(g, 60 * 60_000)!
    expect(c.delta).toBeCloseTo(0.3)
    expect(c.from.time).toBe(min(-50))
  })
  it('gives no trend from a single reading', () => {
    expect(changeWithin(gauge({ readings: [{ time: min(-120), value: 1 }, { time: min(0), value: 2 }] }), 60 * 60_000)).toBeNull()
  })
})

describe('rainfallSince', () => {
  it('sums the reported 5-minute readings after the cut-off', () => {
    const g = gauge({ kind: 'rain', readings: [{ time: min(-70), value: 4 }, { time: min(-30), value: 1.5 }, { time: min(-5), value: 2 }] })
    expect(rainfallSince(g, min(-60))).toEqual({ mm: 3.5, readings: 2 })
  })
})

describe('nearbyGauges', () => {
  it('finds gauges of one kind within range, nearest first', () => {
    const near = gauge({ id: 'near', position: [153.001, -27.5] })
    const far = gauge({ id: 'far', position: [153.2, -27.5] })
    const rain = gauge({ id: 'rain', kind: 'rain', position: [153, -27.5] })
    expect(nearbyGauges([far, rain, near], [153, -27.5], 5, 'stream').map((x) => x.gauge.id)).toEqual(['near'])
  })
})

describe('rainfallTotal', () => {
  it('sums the readings, but has no total for a gauge that reported nothing', () => {
    const g = gauge({ kind: 'rain', readings: [{ time: min(-120), value: 4 }] })
    expect(rainfallTotal(g, min(-180))).toBe(4)
    expect(rainfallTotal(g, min(-60))).toBeNull()
  })
})
