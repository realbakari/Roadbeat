import { describe, expect, it } from 'vitest'
import { latestHeightsRequest, parseQldGauges } from './qldGaugesFeed'

const NOW = Date.parse('2026-10-16T00:30:00+10:00')
const stations = {
  stations: [
    ['143001C', 'Brisbane River at Savages Crossing', 152.668941, -27.439727],
    ['422205A', 'Old station', 149.1, -28.6],
    ['120002C', 'Estimated only', 147.0, -20.0],
    ['999999Z', 'No answer', 150.0, -25.0],
  ],
}
const latest = {
  error_num: 0,
  return: {
    '143001C': [{ values: [{ time_end: '', v: '1.327', q: 130, p: '', trend: '0', time: '20261016001500', time_start: '' }], varto: '100.00', varfrom: '100.00' }],
    '422205A': [{ values: [{ v: '0.5', q: 1, time: '20231101072400' }] }],
    '120002C': [{ values: [{ v: '2.0', q: 60, time: '20261016000000' }] }],
    '888888X': [{ error_num: 20, error_msg: 'Invalid station/datasource' }],
  },
}

describe('parseQldGauges', () => {
  const gauges = parseQldGauges(stations, latest, NOW)

  it('keeps every station and reads the latest height as AEST', () => {
    expect(gauges.map((g) => [g.id, g.source, g.kind, g.readings.length])).toEqual([
      ['143001C', 'qld', 'stream', 1],
      ['422205A', 'qld', 'stream', 0],
      ['120002C', 'qld', 'stream', 0],
      ['999999Z', 'qld', 'stream', 0],
    ])
    expect(gauges[0].position).toEqual([152.668941, -27.439727])
    expect(gauges[0].readings[0]).toEqual({ time: Date.parse('2026-10-16T00:15:00+10:00'), value: 1.327 })
  })

  it('leaves out readings older than 24 hours and derived or estimated values', () => {
    expect(gauges[1].readings).toEqual([])
    expect(gauges[2].readings).toEqual([])
  })
})

describe('latestHeightsRequest', () => {
  it('asks for the telemetered stream water level at each site', () => {
    expect(JSON.parse(latestHeightsRequest(['143001C', '143001D']))).toEqual({
      function: 'get_latest_ts_values',
      version: '2',
      params: { site_list: '143001C,143001D', datasource: 'AT', trace_list: [{ varfrom: '100', varto: '100' }] },
    })
  })
})
