import { describe, expect, it } from 'vitest'
import type { TrafficEvent } from '../api/types'
import { fireWarning, qldWarning, roadEvent } from '../test/fixtures'
import { eventShareText, fireShareText, transitAlertShareText, warningShareText } from './shareText'

describe('eventShareText', () => {
  it('leads with what QLDTraffic says the event does, then where, who and when', () => {
    const e = roadEvent(1, 'Roma   Condamine Road', 'Warkon')
    const closed: TrafficEvent = {
      ...e,
      properties: {
        ...e.properties,
        impact: { direction: 'Both directions', towards: null, impact_type: 'Closures', impact_subtype: 'Road closed to all traffic', delay: null },
        last_updated: '2026-10-19T13:34:00+10:00',
      },
    }
    expect(eventShareText(closed)).toBe('Road closed to all traffic · Both directions: Roma Condamine Road, Warkon · Metropolitan. QLDTraffic, updated Mon, 19 Oct, 1:34 pm AEST.')
  })

  it('falls back to the event type, and leaves out a time it doesn’t have', () => {
    const e = roadEvent(2, 'Bruce Highway', null)
    expect(eventShareText({ ...e, properties: { ...e.properties, impact: null } })).toBe('Crash: Bruce Highway, Metropolitan. QLDTraffic.')
  })
})

describe('the other share texts', () => {
  it('name the level, the place and the publisher, in their own words', () => {
    expect(fireShareText({ ...fireWarning('W1', 'Archer River'), issued: Date.parse('2026-10-19T11:58:00+10:00') })).toBe('Advice: Archer River. Queensland Fire Department, issued Mon, 19 Oct, 11:58 am AEST.')
    expect(warningShareText({ ...qldWarning('Q1', 'Watch and Act', 'Condamine'), callToAction: 'Prepare to leave', from: 'Western Downs Regional Council' })).toBe(
      'Watch and Act: Condamine. Prepare to leave. Western Downs Regional Council.',
    )
    expect(transitAlertShareText({ id: 'a', region: 'SEQ', header: 'Lift outage at Central station', description: '', url: null, cause: '', effect: '', routes: [], stops: 0, stopIds: [], periods: [] })).toBe(
      'Lift outage at Central station. Translink.',
    )
  })
})
