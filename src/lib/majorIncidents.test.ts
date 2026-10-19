import { describe, expect, it } from 'vitest'
import type { TrafficEvent } from '../api/types'
import { fireWarning, qldWarning, roadEvent } from '../test/fixtures'
import { majorIncidents } from './majorIncidents'

const now = Date.parse('2026-10-19T12:00:00+10:00')

const warning = qldWarning

const event = (id: number, over: Partial<TrafficEvent['properties']>): TrafficEvent => {
  const e = roadEvent(id, 'Bruce Highway', 'Gympie')
  return { ...e, properties: { ...e.properties, ...over } }
}

const closed = { direction: null, towards: null, impact_type: 'Closures', impact_subtype: 'Road closed to all traffic', delay: null }

describe('majorIncidents', () => {
  it('leads with Emergency Warnings, then Red Alerts, then Watch and Act, keeping each feed’s order', () => {
    const fires = [{ ...fireWarning('f1', 'Bluff'), level: 'Watch and Act' as const, levelText: 'Watch and Act' }, fireWarning('f2', 'Advice fire')]
    const s = majorIncidents({
      events: [event(7, { event_priority: 'Red Alert' })],
      fires,
      warnings: [warning('w1', 'Emergency Warning', 'Condamine'), warning('w2', 'Advice', 'Isisford')],
      now,
    })
    expect(s.items.map((i) => [i.level, i.title, i.href])).toEqual([
      ['Emergency Warning', 'Condamine', 'place/warning/w1'],
      ['Red Alert', 'Bruce Highway, Gympie', 'event/7'],
      ['Watch and Act', 'Bluff', 'fire/f1'],
    ])
    // Warnings at every level count, fire incidents ("Information") don't.
    expect(s.warnings).toBe(4)
    expect(s.redAlerts).toBe(1)
  })

  it('counts current closures only, not lane closures or roadworks that haven’t started', () => {
    const later = { start: '2026-10-25T07:00:00+10:00', end: '2026-10-26T17:00:00+10:00', active_days: null, recurrences: null }
    const s = majorIncidents({
      events: [
        event(1, { impact: closed }),
        event(2, { impact: { ...closed, impact_subtype: 'One lane closed' } }),
        event(3, { impact: closed, event_type: 'Roadworks', duration: later }),
      ],
      fires: [],
      warnings: [],
      now,
    })
    expect(s.closures).toBe(1)
    expect(s.items).toEqual([])
  })

  it('leaves counts unknown until their feeds have loaded, never zero', () => {
    const s = majorIncidents({ events: null, fires: [], warnings: null, now })
    expect([s.warnings, s.closures, s.redAlerts]).toEqual([null, null, null])
  })
})
