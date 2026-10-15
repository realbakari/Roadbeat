import { describe, expect, it } from 'vitest'
import { parseGauges } from './bccGauges'

const sensors = [
  { sensor_id: 'E1594', location_name: 'Mouth of Breakfast Ck, Newstead', sensor_type: 'Stream Height AHD', unit_of_measure: 'm', latitude: -27.44, longitude: 153.05 },
  { sensor_id: 'E1888', location_name: 'Rain gauge ', sensor_type: 'Rainfall', unit_of_measure: 'mm', latitude: -27.5, longitude: 153.0 },
  { sensor_id: 'E9999', location_name: 'No position', sensor_type: 'Rainfall', unit_of_measure: 'mm' },
]
const csv = [
  '﻿measured,e1594,e1888,yearly_sum',
  '2026-10-15T09:30:00+00:00,-0.41,0,-',
  '2026-10-15T09:25:00+00:00,-,2,-',
  '2026-10-15T09:20:00+00:00,-0.46,1,-',
].join('\n')

describe('parseGauges', () => {
  const gauges = parseGauges(sensors, csv)

  it('joins each gauge with its column and skips gauges without a position', () => {
    expect(gauges.map((g) => [g.id, g.kind])).toEqual([
      ['E1594', 'stream'],
      ['E1888', 'rain'],
    ])
    expect(gauges[1].name).toBe('Rain gauge')
  })

  it('keeps only reported intervals, oldest first', () => {
    expect(gauges[0].readings.map((r) => r.value)).toEqual([-0.46, -0.41])
    expect(gauges[1].readings.map((r) => r.value)).toEqual([1, 2, 0])
    expect(gauges[0].readings[1].time).toBe(Date.parse('2026-10-15T09:30:00Z'))
  })
})
