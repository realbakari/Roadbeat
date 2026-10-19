import { describe, expect, it } from 'vitest'
import { parseCarParkSpaces } from './bccParking'
import { floodWarningArea } from './floodWarnings'
import { parseStationFacilities } from './stationFacilities'
import { isAccessibilityAlert, type TransitAlert } from './translink'

describe('parseStationFacilities', () => {
  it('keeps published text, lists features once, and makes Queensland Rail links absolute', () => {
    const f = parseStationFacilities({
      title: 'Central',
      al: 'Cnr Edward & Ann St',
      sub: 'Brisbane',
      stdet: '**Lift upgrade** on platforms 5 and 6.',
      ln: ['Caboolture'],
      cbay: '0',
      zn: 'Zone 1 - Independent Access',
      sginfor: '* A boarding ramp is available',
      pdffile: '/Customers/Central.pdf',
      facility_lift: true,
      facility_accessible_toilet_lh: true,
      facility_accessible_toilet_rh: true,
      facility_toilets: true,
      facility_bike_rack: 4,
    })
    expect(f).toMatchObject({
      name: 'Central',
      address: 'Cnr Edward & Ann St, Brisbane',
      notice: '**Lift upgrade** on platforms 5 and 6.',
      carBays: null,
      access: [
        { key: 'lift', label: 'Lift' },
        { key: 'accessible_toilet_lh', label: 'Accessible toilet' },
      ],
      other: [{ key: 'toilets', label: 'Toilets' }],
      bikeRacks: 4,
      guide: 'https://www.queenslandrail.com.au/Customers/Central.pdf',
    })
  })

  it('returns null for a record without a station name', () => {
    expect(parseStationFacilities({ al: 'x' })).toBeNull()
  })
})

describe('parseCarParkSpaces', () => {
  it('reads both car parks and when they were published', () => {
    expect(
      parseCarParkSpaces({ results: [{ uploaded_to_open_data_at: '2026-10-15T12:17:04+00:00', king_george_square: 343, wickham_terrace: 419 }] }),
    ).toEqual({ at: Date.parse('2026-10-15T12:17:04+00:00'), kingGeorgeSquare: 343, wickhamTerrace: 419 })
  })
})

describe('floodWarningArea', () => {
  it('links a Brisbane stream gauge to its BoM warning area', () => {
    const area = floodWarningArea('E1594')
    if (area) expect(area.url).toBe(`https://reg.bom.gov.au/cgi-bin/wrap_fwo.pl?${area.product}.html`)
    expect(floodWarningArea('not-a-gauge')).toBeNull()
  })
})

describe('isAccessibilityAlert', () => {
  const alert = (effect: string, header: string) => ({ effect, header }) as TransitAlert
  it('recognises Translink lift and escalator outages', () => {
    expect(isAccessibilityAlert(alert('Accessibility issue', 'Lift outage - Caloundra station'))).toBe(true)
    expect(isAccessibilityAlert(alert('Other effect', 'Escalator outage - Central'))).toBe(true)
    expect(isAccessibilityAlert(alert('Reduced service', 'Track closures'))).toBe(false)
  })
})
