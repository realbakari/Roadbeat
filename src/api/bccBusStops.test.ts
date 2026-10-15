import { describe, expect, it } from 'vitest'
import { parseBusStopAudit } from './bccBusStops'

describe('parseBusStopAudit', () => {
  it('reads the council ratings as published and tidies the type and suburb', () => {
    expect(
      parseBusStopAudit({
        hastus: '2315',
        description: 'Hexham Street - 49',
        streetname: 'Marshall Rd',
        nearest_cross_street: 'Hexham St',
        suburb: 'TARRAGINDI',
        bus_stop_type: '3 - Regular with seat',
        boarding_point: 'Easy',
        road_gradient: 'Medium',
        cross_fall: 'Hard',
        tactile_ground_surf_indicat_y_n: 'Y',
        date_of_last_audit: '2019-04-12T02:00:00+00:00',
      }),
    ).toEqual({
      name: 'Hexham Street - 49',
      street: 'Marshall Rd',
      crossStreet: 'Hexham St',
      suburb: 'Tarragindi',
      type: 'Regular with seat',
      boarding: 'Easy',
      gradient: 'Medium',
      crossFall: 'Hard',
      tactile: true,
      audited: '2019-04-12',
    })
  })

  it('leaves out ratings the council has not given rather than guessing', () => {
    const a = parseBusStopAudit({ hastus: 1802, description: 'University of Queensland - Zone E', bus_stop_type: 'Bus Station', boarding_point: null, tactile_ground_surf_indicat_y_n: null })
    expect(a).toMatchObject({ type: 'Bus Station', boarding: null, gradient: null, tactile: null, audited: null })
    expect(parseBusStopAudit({ hastus: 1 })).toBeNull()
  })
})
