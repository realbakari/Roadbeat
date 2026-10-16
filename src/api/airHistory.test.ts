import { describe, expect, it } from 'vitest'
import { brisbaneDate, departmentChartUrl, historyRange, parseMeasurements, parseParameters } from './airHistory'

// As the API answered for the Brisbane CBD station on 16 October 2026.
const PARAMETERS = [
  { parameter_id: 18, parameter_name: 'Particle PM10', abbreviation: 'PM10', units: 'µg/m³', '1hr_standard': 100, standard: 50, category_id: 1, link: 'https://www.qld.gov.au/environment/pollution/monitoring/air-pollution/particles', standard_units: 'µg/m³ (24hr avg)' },
  { parameter_id: 10, parameter_name: 'Temperature', abbreviation: 'Temp', units: '°C', '1hr_standard': 100, standard: 0, category_id: 2, link: 'NOT_USED', standard_units: 'deg C (1hr avg)' },
  { parameter_id: 8, parameter_name: 'Carbon monoxide', abbreviation: 'CO', units: 'ppm', '1hr_standard': 0, standard: 9, category_id: 1, link: 'https://www.qld.gov.au/co', standard_units: 'ppm (8hr avg)' },
]

const MEASUREMENTS = [
  { station_id: 'cbd', parameter_id: 18, date_measured: '2026-10-16T12:00:00.000Z', mvalue: 11, mvalue_units: 'µg/m³', mvalue_running_avg: 10.8, air_quality_index: 21.6, '1hr_air_quality_index': 11, validated: 'N', category_id: 1 },
  { station_id: 'cbd', parameter_id: 18, date_measured: '2026-10-16T10:00:00.000Z', mvalue: null, mvalue_running_avg: null, air_quality_index: null, validated: 'N', category_id: 1 },
  { station_id: 'cbd', parameter_id: 18, date_measured: '2026-10-16T09:00:00.000Z', mvalue: -9999, mvalue_running_avg: -9999, air_quality_index: -9999, validated: 'N', category_id: 1 },
  { station_id: 'cbd', parameter_id: 18, date_measured: '2026-10-16T08:00:00.000Z', mvalue: 9.1, mvalue_running_avg: -1111, air_quality_index: 18, validated: 'N', category_id: 1 },
  { station_id: 'cbd', parameter_id: 18, date_measured: '2026-10-16T11:00:00.000Z', mvalue: 10.6, mvalue_units: 'µg/m³', mvalue_running_avg: 10.9, air_quality_index: 21.8, '1hr_air_quality_index': 10.6, validated: 'Y', category_id: 1 },
]

describe('parseParameters', () => {
  it("keeps each parameter's published standards, air quality before weather", () => {
    const [co, pm10, temp] = parseParameters(PARAMETERS)
    expect([co.name, pm10.name, temp.name]).toEqual(['Carbon monoxide', 'Particle PM10', 'Temperature'])
    expect(pm10).toEqual({ id: 18, name: 'Particle PM10', abbreviation: 'PM10', units: 'µg/m³', hourStandard: 100, standard: { value: 50, label: 'µg/m³ (24hr avg)' }, category: 1, link: 'https://www.qld.gov.au/environment/pollution/monitoring/air-pollution/particles' })
    // A zero standard is "none published", and NOT_USED is not a link.
    expect(co.hourStandard).toBeNull()
    expect(temp.standard).toBeNull()
    expect(temp.link).toBeNull()
  })

  it('returns nothing for a body that is not a list', () => {
    expect(parseParameters({ message: 'Validation errors' })).toEqual([])
  })
})

describe('parseMeasurements', () => {
  it("orders readings by time and drops hours without a value or marked with the department's gap codes", () => {
    const readings = parseMeasurements(MEASUREMENTS)
    expect(readings.map((r) => new Date(r.time).toISOString())).toEqual(['2026-10-16T08:00:00.000Z', '2026-10-16T11:00:00.000Z', '2026-10-16T12:00:00.000Z'])
    expect(readings[1]).toEqual({ time: Date.parse('2026-10-16T11:00:00Z'), value: 10.6, runningAvg: 10.9, index: 21.8, validated: true })
    expect(readings[2].validated).toBe(false)
    // An offline running average is a gap in that line only.
    expect(readings[0]).toMatchObject({ value: 9.1, runningAvg: null, index: 18 })
  })
})

describe('historyRange', () => {
  const now = Date.parse('2026-10-16T12:20:00Z') // 10:20 pm in Queensland

  it('ends a current chart at the end of the current hour', () => {
    const r = historyRange('day', null, now)
    expect(new Date(r.end).toISOString()).toBe('2026-10-16T13:00:00.000Z')
    expect((r.end - r.start) / 3_600_000).toBe(24)
    expect(historyRange('week', '2026-10-16', now).end).toBe(r.end)
  })

  it('ends a past chart at the end of that Queensland day', () => {
    const r = historyRange('month', '2026-03-01', now)
    expect(new Date(r.end).toISOString()).toBe('2026-03-01T13:59:59.000Z')
    expect((r.end - r.start) / 3_600_000).toBe(24 * 30)
  })

  it('knows the Queensland date', () => {
    expect(brisbaneDate(Date.parse('2026-10-16T15:00:00Z'))).toBe('2026-10-17')
  })
})

describe('departmentChartUrl', () => {
  it("links to the department's chart with its own date format", () => {
    expect(departmentChartUrl('cbd', 18, 'month', '2026-03-01')).toBe('https://apps.des.qld.gov.au/air-quality/chart/?station=cbd&parameter=18&date=1%2F03%2F2026&timeframe=month')
  })
})
