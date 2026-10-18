import { describe, expect, it } from 'vitest'
import { roadEvent } from '../test/fixtures'
import { eventPlace, eventTitle } from './eventText'

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
