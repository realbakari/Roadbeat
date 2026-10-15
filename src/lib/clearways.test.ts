import { describe, expect, it } from 'vitest'
import { clearwayInEffect, parseClearwayTimes, type ClearwaySchedule } from './clearways'

const WEEKDAYS = [1, 2, 3, 4, 5]
const h = (hh: number, mm = 0) => hh * 60 + mm
const windows = (s: ClearwaySchedule) => (s.kind === 'windows' ? s.windows : s.kind)

describe('parseClearwayTimes', () => {
  it.each([
    ['7AM-9AM  4PM-7PM MON-FRI', [{ days: WEEKDAYS, start: h(7), end: h(9) }, { days: WEEKDAYS, start: h(16), end: h(19) }]],
    ['7AM - 9AM MON - FRI', [{ days: WEEKDAYS, start: h(7), end: h(9) }]],
    ['7-9AM 4-7PM M-F', [{ days: WEEKDAYS, start: h(7), end: h(9) }, { days: WEEKDAYS, start: h(16), end: h(19) }]],
    ['4 -  7PM MON - FRI', [{ days: WEEKDAYS, start: h(16), end: h(19) }]],
    ['6:30-9:30AM MON - FRI', [{ days: WEEKDAYS, start: h(6, 30), end: h(9, 30) }]],
    ['3:30-7:00 PM MON - FRI', [{ days: WEEKDAYS, start: h(15, 30), end: h(19) }]],
    ['2.30PM-6PM MON-FRI', [{ days: WEEKDAYS, start: h(14, 30), end: h(18) }]],
    ['7AM - 9AM & 4PM - 6PM MON-FRI', [{ days: WEEKDAYS, start: h(7), end: h(9) }, { days: WEEKDAYS, start: h(16), end: h(18) }]],
    ['7AM-7PM DAILY', [{ days: [0, 1, 2, 3, 4, 5, 6], start: h(7), end: h(19) }]],
    ['7AM TO 7PM MON TO SUN', [{ days: [1, 2, 3, 4, 5, 6, 0], start: h(7), end: h(19) }]],
    ['7AM-7PM M-F TOW AWAY', [{ days: WEEKDAYS, start: h(7), end: h(19) }]],
    ['C TOWAWAY 7AM-10AM MON-FRI', [{ days: WEEKDAYS, start: h(7), end: h(10) }]],
    ['4PM - 6PM MON', [{ days: [1], start: h(16), end: h(18) }]],
    ['7AM - 7PM', [{ days: [0, 1, 2, 3, 4, 5, 6], start: h(7), end: h(19) }]],
    [
      '3-7PM MON-FRI, 10AM-2PM SAT',
      [
        { days: WEEKDAYS, start: h(15), end: h(19) },
        { days: [6], start: h(10), end: h(14) },
      ],
    ],
    [
      '9AM-6PM M-F, 7AM-NOON SAT',
      [
        { days: WEEKDAYS, start: h(9), end: h(18) },
        { days: [6], start: h(7), end: h(12) },
      ],
    ],
    [
      '7-9AM, 4-7PM MON-SAT',
      [
        { days: [1, 2, 3, 4, 5, 6], start: h(7), end: h(9) },
        { days: [1, 2, 3, 4, 5, 6], start: h(16), end: h(19) },
      ],
    ],
  ])('reads %s', (raw, expected) => {
    expect(windows(parseClearwayTimes(raw))).toEqual(expected)
  })

  it('reads "at all times" and leaves anything unclear unknown', () => {
    expect(parseClearwayTimes('AT ALL TIMES').kind).toBe('always')
    expect(parseClearwayTimes('AT ALL TIMES ALONG OVERPASS').kind).toBe('always')
    expect(parseClearwayTimes('CLEARWAY AT ALL TIMES').kind).toBe('always')
    expect(parseClearwayTimes('CLEARWAY(REPEATER) 7AM - 7PM M').kind).toBe('unknown')
    expect(parseClearwayTimes('NO TIME DATA AVAILABLE').kind).toBe('unknown')
    expect(parseClearwayTimes(null).kind).toBe('unknown')
    expect(parseClearwayTimes('7AM-9PM & 4PM -6PM  MON-FRI').kind).toBe('windows')
    expect(parseClearwayTimes('SOMETIMES').kind).toBe('unknown')
  })
})

describe('clearwayInEffect', () => {
  // Thursday 15 October 2026, Brisbane time.
  const at = (hhmm: string, d = 15) => Date.parse(`2026-10-${d}T${hhmm}:00+10:00`)
  const peak = parseClearwayTimes('7AM-9AM  4PM-7PM MON-FRI')

  it('is in effect inside the signed windows on signed days only', () => {
    expect(clearwayInEffect(peak, at('08:30'))).toBe(true)
    expect(clearwayInEffect(peak, at('09:00'))).toBe(false)
    expect(clearwayInEffect(peak, at('17:00'))).toBe(true)
    expect(clearwayInEffect(peak, at('08:30', 17))).toBe(false)
    expect(clearwayInEffect(parseClearwayTimes('AT ALL TIMES'), at('03:00'))).toBe(true)
    expect(clearwayInEffect(parseClearwayTimes(null), at('08:30'))).toBeNull()
  })
})
