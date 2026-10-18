import { describe, expect, it } from 'vitest'
import { roadEvent } from '../test/fixtures'
import { isClosure, isLaneClosure } from './eventStatus'
import { eventIconId, impactIconId } from './impactIcons'

describe('impactIconId', () => {
  it('gives the impacts QLDTraffic has its own pins for their own icons', () => {
    expect(impactIconId('Road closed to all traffic')).toBe('closure-all')
    expect(impactIconId('Road closed to through traffic')).toBe('closure-thru')
    expect(impactIconId('One lane closed')).toBe('impact-lane')
    expect(impactIconId('Partial lane closures')).toBe('impact-lane')
    expect(impactIconId('Restricted to four wheel drive vehicles only')).toBe('impact-4wd')
    expect(impactIconId('Restricted to high clearance vehicles only')).toBe('impact-hcv')
    expect(impactIconId('Subject to a 42.5 tonne GVM limit')).toBe('impact-gvm-42.5')
    expect(impactIconId('Limited to 80% of legislative axle group limit')).toBe('impact-axle')
  })

  it('leaves other impacts, and mass limits it has no pin for, to the event type', () => {
    expect(impactIconId('Lane or lanes reduced')).toBeNull()
    expect(impactIconId('Subject to a 7 tonne GVM limit')).toBeNull()
    expect(impactIconId(null)).toBeNull()
  })
})

describe('eventIconId', () => {
  it('puts a Red Alert first, then an upcoming outline, then the impact, then the type', () => {
    expect(eventIconId('Crash', 'Road closed to all traffic', false, 'Red Alert')).toBe('event-red-alert')
    expect(eventIconId('Roadworks', 'One lane closed', true, 'Medium')).toBe('event-roadworks-future')
    expect(eventIconId('Roadworks', 'One lane closed', false, 'Medium')).toBe('impact-lane')
    expect(eventIconId('Special event', 'Lane or lanes reduced', false, 'Low')).toBe('event-special-event')
  })
})

describe('isClosure and isLaneClosure', () => {
  const withImpact = (impact_type: string, impact_subtype: string | null) => {
    const e = roadEvent(1, 'Booral Road', 'Urangan')
    return { ...e, properties: { ...e.properties, impact: { ...e.properties.impact!, impact_type, impact_subtype } } }
  }

  it('counts a lane closure as a lane closure, not a closed road', () => {
    const lane = withImpact('Closures', 'One lane closed')
    expect(isClosure(lane)).toBe(false)
    expect(isLaneClosure(lane)).toBe(true)
    expect(isClosure(withImpact('Closures', 'Partial lane closures'))).toBe(false)
  })

  it('counts a road closed to all or through traffic, or an unnamed closure, as closed', () => {
    expect(isClosure(withImpact('Closures', 'Road closed to all traffic'))).toBe(true)
    expect(isClosure(withImpact('Closures', 'Road closed to through traffic'))).toBe(true)
    expect(isClosure(withImpact('Closures', null))).toBe(true)
    expect(isClosure(withImpact('Lanes affected', 'All lanes affected'))).toBe(false)
  })
})
