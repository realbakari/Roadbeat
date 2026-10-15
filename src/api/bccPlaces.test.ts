import { describe, expect, it } from 'vitest'
import { bayTimes, parseAccessibleBays, parseClearways, parseToilets } from './bccPlaces'
import { parseFerryTerminal } from './ferryTerminals'

const line = { geometry: { type: 'LineString', coordinates: [[153, -27.4], [153.001, -27.401]] } }

describe('parseClearways', () => {
  it('keeps clearways with their signed times and drops other categories', () => {
    const list = parseClearways([
      { objectid: '505', category: 'Clearway', operational_time: '7AM-9AM MON-FRI', geo_shape: line },
      { objectid: '6', category: 'Loading Zone', operational_time: '7am-7pm MON-SAT', geo_shape: line },
      { objectid: '7', category: 'Clearway', operational_time: null, geo_shape: line },
    ])
    expect(list.map((c) => [c.id, c.times])).toEqual([
      ['505', '7AM-9AM MON-FRI'],
      ['7', null],
    ])
  })
})

describe('parseToilets', () => {
  it('reads the toilet map flags', () => {
    const [t] = parseToilets([
      { facilityid: 39357, name: 'Queens Plaza', address1: '226 Queen Street', town: 'Brisbane City', latitude: -27.46874, longitude: 153.02639, openinghours: 'OPEN: Mon 9am-5pm', accessible: 'True', ambulant: 'True', changingplaces: 'False', mlak24: 'False', babychange: 'True', parkingaccessible: 'True', url: 'https://toiletmap.gov.au/facility/39357' },
    ])
    expect(t).toMatchObject({ id: '39357', address: '226 Queen Street, Brisbane City', accessible: true, ambulant: true, changingPlaces: false, mlak: false, babyChange: true, accessibleParking: true })
  })
})

describe('accessible parking', () => {
  it('splits sign panels and drops the "null" day placeholder', () => {
    expect(bayTimes('null:7 AM-4 PM ,MON-FRI:7:00AM-10:00AM ,SAT-SUN:7:00AM-7:00PM')).toEqual(['7 AM-4 PM', 'MON-FRI 7:00AM-10:00AM', 'SAT-SUN 7:00AM-7:00PM'])
    expect(bayTimes(null)).toEqual([])
  })

  it('title-cases streets and skips signs no longer in service', () => {
    const list = parseAccessibleBays([
      { objectid: '1', street: 'ALICE STREET', suburb: 'BRISBANE CITY', latitude: -27.47, longitude: 153.03, parkingrestrictiondaysandtimes: null, assetlifecycle: 'In Service' },
      { objectid: '2', street: 'X', suburb: 'Y', latitude: -27.47, longitude: 153.03, assetlifecycle: 'Removed' },
    ])
    expect(list.map((b) => [b.id, b.street, b.suburb])).toEqual([['1', 'Alice Street', 'Brisbane City']])
  })
})

describe('parseFerryTerminal', () => {
  it('lists the access features the council records', () => {
    const t = parseFerryTerminal({
      hastus: '321666',
      description: 'South Bank ferry terminal',
      streetname: 'Clem Jones Promanade',
      suburb: 'South Brisbane',
      status: 'ACTIVE',
      dda_compliant: 'Yes',
      gangway_level_landing: 'Yes',
      lift_access: 'No',
      seat_present: 'Yes',
      toilet: 'No',
      accessible_toilet: 'Toilet available on CityCat ferries',
      last_inspection_date: '2024-02-21T01:00:00+00:00',
    })
    expect(t?.access.map((a) => a.label)).toEqual(['Accessible terminal (DDA compliant)', 'Level landing at the gangway'])
    expect(t).toMatchObject({ toiletNote: 'Toilet available on CityCat ferries', inspected: '2024-02-21' })
  })
})

describe('parking meters and bike stops', () => {
  it('reads meter rates, hours and restrictions as published', async () => {
    const { parseParkingMeters, parseBikeRacks } = await import('./bccPlaces')
    const [m] = parseParkingMeters([
      { meter_no: '4597', category: 'TICKETLESS METER MULTISPACE', street: 'KING ST', suburb: 'BOWEN HILLS', max_stay_hrs: '2', restrictions: 'NONE', operational_day: '7 DAYS', operational_time: '7AM-7PM', tar_zone: 'Zone 1, 15 min free', tar_rate_weekday: 6.85, tar_rate_ah_we: '3.7', loc_desc: 'King St between St Pauls Tce and Gregory Tce', veh_bays: '5', mobile_zone: '4000502', max_cap_chg: null, longitude: 153.0337, latitude: -27.452412 },
    ])
    expect(m).toMatchObject({ street: 'King St', suburb: 'Bowen Hills', maxStayHours: 2, rate: 6.85, afterHoursRate: 3.7, cap: null, bays: 5, payment: 'Ticketless meter or app', restriction: null })
    const [r] = parseBikeRacks([{ objectid: 4, suburb: 'Brisbane City', address: '101 Edward Street', location: 'Footpath', capacity: 2, rack_type: 'Holding rail', latitude: -27.47, longitude: 153.029 }])
    expect(r).toMatchObject({ id: 'rack-4', kind: 'rack', name: '101 Edward Street', detail: 'Holding rail · Footpath', capacity: 2 })
  })
})
