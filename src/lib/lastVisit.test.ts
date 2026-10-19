import { describe, expect, it } from 'vitest'
import { roadEvent } from '../test/fixtures'
import { newSince, parseVisit, visitOf } from './lastVisit'

const events = [roadEvent(1, 'Bruce Highway', 'Gympie'), roadEvent(2, 'Warrego Highway', 'Gatton'), roadEvent(3, 'Ipswich Road', 'Annerley')]

describe('newSince', () => {
  it('marks the events that weren’t listed at the last visit', () => {
    expect([...newSince({ at: 0, ids: [1, 3, 99] }, events)]).toEqual([2])
  })

  it('marks nothing on a first visit, rather than everything', () => {
    expect(newSince(null, events).size).toBe(0)
  })
})

describe('parseVisit and visitOf', () => {
  it('round-trips a visit, and drops anything of the wrong shape', () => {
    const v = visitOf(events, 1_000)
    expect(parseVisit(JSON.parse(JSON.stringify(v)))).toEqual({ at: 1_000, ids: [1, 2, 3] })
    expect(parseVisit({ at: 5, ids: [1, 'x', null] })).toEqual({ at: 5, ids: [1] })
    expect(parseVisit({ ids: [1] })).toBeNull()
    expect(parseVisit(null)).toBeNull()
  })
})
