import { describe, expect, it } from 'vitest'
import { parseRoadOccupancies, type RoadOccupancy } from '../api/bccRoadOccupancies'
import { inHoursNow, occupanciesToday, occupancyMatches, sortOccupancies } from './roadOccupancies'

// Thursday 15 October 2026, Brisbane time.
const at = (hhmm: string, d = 15) => Date.parse(`2026-10-${d}T${hhmm}:00+10:00`)
const occ = (o: Partial<RoadOccupancy>): RoadOccupancy => ({
  id: 'x',
  road: 'Bradman Street',
  from: 'Beaudesert Road',
  to: null,
  suburb: 'Acacia Ridge',
  closure: '1 of 2 Lanes',
  direction: null,
  work: null,
  period: 'Daily',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  startTime: '07:00',
  finishTime: '16:00',
  ...o,
})

describe('parseRoadOccupancies', () => {
  it('title-cases council capitals and leaves out contact details', () => {
    const [o] = parseRoadOccupancies([
      { certificate: '1', road_primary: 'KINGSFORD SMITH DRIVE', '1st_cross_street': 'INNER CITY BYPASS', '2nd_cross_street': null, suburb: 'ALBION', closure_type: 'Full Closure', direction: 'Both Directions', job_description: 'Construction', period: 'Overnight', start_date: '2026-06-04', end_date: '2027-03-31', start_time: '20:00:00', finish_time: '05:00:00', contact: 'A Person(0400000000)' },
    ])
    expect(o).toMatchObject({ road: 'Kingsford Smith Drive', from: 'Inner City Bypass', suburb: 'Albion', startTime: '20:00', finishTime: '05:00' })
    expect(JSON.stringify(o)).not.toContain('0400000000')
  })
})

describe('occupanciesToday', () => {
  it('respects dates and weekend-only periods', () => {
    const list = [occ({ id: 'daily' }), occ({ id: 'weekend', period: 'Weekends' }), occ({ id: 'ended', endDate: '2026-10-14' })]
    expect(occupanciesToday(list, at('10:00')).map((o) => o.id)).toEqual(['daily'])
    expect(occupanciesToday(list, at('10:00', 17)).map((o) => o.id)).toEqual(['daily', 'weekend'])
  })
})

describe('inHoursNow', () => {
  it('handles day and overnight windows', () => {
    expect(inHoursNow(occ({}), at('12:00'))).toBe(true)
    expect(inHoursNow(occ({}), at('17:00'))).toBe(false)
    const night = occ({ period: 'Overnight', startTime: '20:00', finishTime: '05:00', startDate: '2026-10-15', endDate: '2026-10-15' })
    expect(inHoursNow(night, at('21:00'))).toBe(true)
    expect(inHoursNow(night, at('04:00', 16))).toBe(true)
    expect(inHoursNow(night, at('04:00'))).toBe(false)
  })
})

describe('sortOccupancies and occupancyMatches', () => {
  it('puts full closures first and searches roads and suburbs', () => {
    const list = sortOccupancies([occ({ id: 'lane' }), occ({ id: 'full', closure: 'Full Closure', road: 'Zillmere Road' })], at('12:00'))
    expect(list.map((o) => o.id)).toEqual(['full', 'lane'])
    expect(occupancyMatches(occ({}), 'acacia bradman')).toBe(true)
    expect(occupancyMatches(occ({}), 'toowong')).toBe(false)
  })
})
