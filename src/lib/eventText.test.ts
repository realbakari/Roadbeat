import { describe, expect, it } from 'vitest'
import type { TrafficEvent } from '../api/types'
import { roadEvent } from '../test/fixtures'
import { eventPlace, eventTitle, impactLine } from './eventText'

describe('eventTitle', () => {
  it('names the road, then the subtype, then the event type', () => {
    const e = roadEvent(1, 'Bruce Highway', 'Caboolture')
    expect(eventTitle(e)).toBe('Bruce Highway')
    const noRoad = { ...e, properties: { ...e.properties, road_summary: null, event_subtype: 'Fallen tree' } }
    expect(eventTitle(noRoad)).toBe('Fallen tree')
    expect(eventTitle({ ...noRoad, properties: { ...noRoad.properties, event_subtype: ' N/A ' } })).toBe('Crash')
  })
})

describe('eventPlace', () => {
  it('joins the locality and district that are published', () => {
    expect(eventPlace(roadEvent(1, 'Bruce Highway', 'Caboolture'))).toBe('Caboolture · Metropolitan')
    expect(eventPlace(roadEvent(1, 'Bruce Highway', null))).toBe('Metropolitan')
  })
})

describe('impactLine', () => {
  const withImpact = (impact: TrafficEvent['properties']['impact']) => {
    const e = roadEvent(1, 'Warrego Highway', 'Rosewood')
    return { ...e, properties: { ...e.properties, impact } }
  }

  it('joins the published impact, direction and delay', () => {
    const e = withImpact({ direction: 'Southbound', towards: 'Rosewood ', impact_type: 'Closures', impact_subtype: 'Road closed to all traffic', delay: 'Delays expected' })
    expect(impactLine(e)).toBe('Road closed to all traffic · Southbound towards Rosewood · Delays expected')
  })

  it('falls back to the impact type and leaves out blank, N/A and unknown parts', () => {
    expect(impactLine(withImpact({ direction: 'Unknown', towards: null, impact_type: 'No blockage', impact_subtype: '', delay: '' }))).toBe('No blockage')
    expect(impactLine(withImpact({ direction: 'Both directions', towards: null, impact_type: 'N/A', impact_subtype: null, delay: null }))).toBe('Both directions')
    expect(impactLine(withImpact({ direction: null, towards: null, impact_type: 'N/A', impact_subtype: null, delay: '' }))).toBeNull()
    expect(impactLine(withImpact(null))).toBeNull()
  })
})
