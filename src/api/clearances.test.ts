import { describe, expect, it } from 'vitest'
import { formatDay } from '../lib/format'
import { clearanceLabel, parseBccClearances, parseQrClearances, parseQrExtractDate } from './clearances'

const bcc = [
  {
    restriction_type: 'Height Restriction',
    restriction_id: 'B0949 - 53',
    lat: -27.461107,
    long: 153.011705,
    signed_clearance_min: 4.1,
    signed_clearance_max: -9999.0,
    description: 'Hale Street Service Road under Pedestrian Bridge - Southbound',
    structure_owner: 'BCC',
    structure_owner_contact_details: '07 3403 8888',
    road_owner: 'TMR',
    road_owner_contact_details: '13 23 80',
    validation_date: '2020-10-08',
  },
  { restriction_id: 'BROKEN', lat: -27.4, long: 153, signed_clearance_min: null },
]

const qr = [
  {
    clearance_category: 'Low clearance <4.6m',
    latitude: -27.430716,
    longitude: 153.064722,
    road_clearance_m: 3.4,
    street: 'Ascot Subway',
    suburb: 'Ascot',
    structure_owner: 'Queensland Rail',
    structure_owner_contact: '1800 079 303',
  },
  { latitude: -27.5, longitude: 153, road_clearance_m: 0, street: 'Zero Street' },
]

describe('parseBccClearances', () => {
  const [c, ...rest] = parseBccClearances(bcc)

  it('keeps the published clearance and validation date', () => {
    expect(c).toMatchObject({
      id: 'bcc-B0949 - 53',
      source: 'bcc',
      position: [153.011705, -27.461107],
      metres: 4.1,
      title: 'Hale Street Service Road under Pedestrian Bridge - Southbound',
      roadOwner: 'TMR',
      roadOwnerPhone: '13 23 80',
      dated: '2020-10-08',
    })
  })

  it('skips rows without a clearance', () => {
    expect(rest).toEqual([])
  })
})

describe('parseQrClearances', () => {
  const list = parseQrClearances(qr, '2026-09-16')

  it('ids bridges by position and dates them by the extract', () => {
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: 'qr--27.430716,153.064722',
      metres: 3.4,
      title: 'Ascot Subway',
      suburb: 'Ascot',
      category: 'Low clearance <4.6m',
      ownerPhone: '1800 079 303',
      dated: '2026-09-16',
    })
  })
})

describe('parseQrExtractDate', () => {
  it('reads the temporal coverage date', () => {
    expect(parseQrExtractDate({ metas: { custom: { 'data-temporal-coverage-from-custom': '2026-09-16' } } })).toBe('2026-09-16')
  })

  it('returns null when metadata is missing or malformed', () => {
    expect(parseQrExtractDate(null)).toBeNull()
    expect(parseQrExtractDate({ metas: { custom: { 'data-temporal-coverage-from-custom': 'soon' } } })).toBeNull()
  })
})

describe('clearanceLabel', () => {
  it('never rounds', () => {
    expect(clearanceLabel(4.45)).toBe('4.45 m')
    expect(clearanceLabel(3.8)).toBe('3.8 m')
  })
})

describe('formatDay', () => {
  it('formats a calendar date without shifting it', () => {
    expect(formatDay('2020-10-08')).toBe('8 Oct 2020')
    expect(formatDay('not a date')).toBeNull()
  })
})
