import { describe, expect, it } from 'vitest'
import type { AirReading } from '../api/airHistory'
import { axisLabel, segments } from './airChart'

const H = 3_600_000
const at = (hour: number, value: number, runningAvg: number | null = null): AirReading => ({ time: hour * H, value, runningAvg, index: null, validated: false })

describe('segments', () => {
  it('breaks the line at a missing hour and at a reading without the picked value', () => {
    const readings = [at(1, 5), at(2, 6), at(4, 7, 1), at(5, 8, null), at(6, 9, 2)]
    expect(segments(readings, (r) => r.value)).toEqual([
      [
        [1 * H, 5],
        [2 * H, 6],
      ],
      [
        [4 * H, 7],
        [5 * H, 8],
        [6 * H, 9],
      ],
    ])
    expect(segments(readings, (r) => r.runningAvg)).toEqual([[[4 * H, 1]], [[6 * H, 2]]])
  })

  it('gives no segments for no readings', () => {
    expect(segments([], (r) => r.value)).toEqual([])
  })
})

describe('axisLabel', () => {
  it('shows fewer decimals for larger values', () => {
    expect([axisLabel(0.065), axisLabel(10.8), axisLabel(235)]).toEqual(['0.07', '10.8', '235'])
  })
})
