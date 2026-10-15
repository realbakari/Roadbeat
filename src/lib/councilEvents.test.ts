import { describe, expect, it } from 'vitest'
import type { CouncilEvent } from '../api/bccDashboard'
import { councilEventId, eventsOn, eventsWeek } from './councilEvents'

const base: CouncilEvent = {
  id: '1',
  title: 'Walk',
  description: null,
  venue: null,
  address: null,
  venueType: null,
  start: Date.parse('2026-10-16T10:00:00+10:00'),
  end: Date.parse('2026-10-16T12:00:00+10:00'),
  when: null,
  url: null,
  types: [],
  primaryType: null,
  cost: null,
  age: null,
  ageRange: [],
  bookings: null,
  bookingsRequired: null,
  meetingPoint: null,
  requirements: null,
  image: null,
  status: null,
  position: [153, -27.5],
}

describe('eventsWeek', () => {
  it('runs from Brisbane midnight today for eight days', () => {
    const { from, to } = eventsWeek(Date.parse('2026-10-16T23:30:00+10:00'))
    expect(from).toBe(Date.parse('2026-10-16T00:00:00+10:00'))
    expect(to).toBe(Date.parse('2026-10-24T00:00:00+10:00'))
  })
})

describe('eventsOn', () => {
  const from = Date.parse('2026-10-16T00:00:00+10:00')
  const to = Date.parse('2026-10-24T00:00:00+10:00')

  it('keeps events in the window and ongoing ones that started earlier', () => {
    const ongoing = { ...base, id: '2', start: Date.parse('2025-04-06T14:00:00Z'), end: Date.parse('2027-04-01T14:00:00Z') }
    const past = { ...base, id: '3', start: Date.parse('2026-10-15T10:00:00+10:00'), end: Date.parse('2026-10-15T12:00:00+10:00') }
    const later = { ...base, id: '4', start: Date.parse('2026-10-24T10:00:00+10:00'), end: null }
    expect(eventsOn([base, ongoing, past, later], from, to).map((e) => e.id)).toEqual(['1', '2'])
  })

  it('leaves out events the council has no position for', () => {
    expect(eventsOn([{ ...base, position: null }], from, to)).toEqual([])
  })
})

describe('councilEventId', () => {
  it('takes the Trumba event id from the council link', () => {
    expect(councilEventId('https://www.brisbane.qld.gov.au/trumba?trumbaEmbed=view%3Devent%26eventid%3D182353296', 'x', 'y')).toBe('182353296')
  })

  it('hashes the title and start when there is no link, the same way each time', () => {
    const a = councilEventId(null, 'Pilates', '2026-10-16T00:00:00+00:00')
    expect(a).toBe(councilEventId(undefined, ' Pilates ', '2026-10-16T00:00:00+00:00'))
    expect(a).not.toBe(councilEventId(null, 'Pilates', '2026-10-17T00:00:00+00:00'))
  })
})
