import { describe, expect, it } from 'vitest'
import { at, stopIndex, trip } from '../test/fixtures'
import { planJourneys, stopAndChildren } from './planner'
import { filterJourneys, moveTrip, nextJourneys, removeTrip, renameTrip, saveTrip, tripFilter, type SavedTrip } from './savedTrips'

const a: SavedTrip = { region: 'SEQ', from: 'place_a', to: 'place_b' }
const b: SavedTrip = { region: 'SEQ', from: 'place_b', to: 'c1' }
const c: SavedTrip = { region: 'SEQ', from: 'c1', to: 'd1' }

describe('saved trip list', () => {
  it('adds a trip once and updates its filter in place, keeping its name', () => {
    const list = saveTrip(saveTrip([], { ...a, name: 'Work' }), b)
    expect(saveTrip(list, { ...a, modes: ['train'] })).toEqual([{ ...a, name: 'Work', modes: ['train'] }, b])
  })

  it('renames, and a blank name goes back to the stop names', () => {
    const named = renameTrip([a, b], b, '  Gym ')
    expect(named[1]).toEqual({ ...b, name: 'Gym' })
    expect(renameTrip(named, b, ' ')[1]).toEqual(b)
  })

  it('reorders within the ends of the list', () => {
    expect(moveTrip([a, b, c], c, -1)).toEqual([a, c, b])
    expect(moveTrip([a, b, c], a, 1)).toEqual([b, a, c])
    expect(moveTrip([a, b, c], a, -1)).toEqual([a, b, c])
  })

  it('removes a trip', () => {
    expect(removeTrip([a, b, c], { ...b, name: 'x' })).toEqual([a, c])
  })

  it('saves no filter for every mode with changes', () => {
    expect(tripFilter(['tram', 'ferry', 'bus', 'train'], false)).toEqual({})
    expect(tripFilter(new Set(['ferry', 'train']), true)).toEqual({ modes: ['train', 'ferry'], direct: true })
  })
})

describe('next journeys for a saved trip', () => {
  const stops = stopIndex()
  const ids = (id: string) => stopAndChildren(stops, stops.get('SEQ', id)!)
  const journeys = planJourneys(
    [
      trip(1, 'TRAIN', [['a1', 480], ['b1', 490]]),
      trip(2, 'BUS', [['a2', 500], ['b2', 512]]),
      trip(3, 'TRAIN', [['a1', 520], ['b1', 530]]),
      trip(4, 'TRAIN', [['a1', 540], ['c1', 545], ['b1', 555]]),
    ],
    stops,
    ids('place_a'),
    ids('place_b'),
  )
  const modeOf = (l: (typeof journeys)[number]['legs'][number]) => (l.trip.route === 'BUS' ? 'bus' : 'train')

  it('keeps only journeys on the chosen modes', () => {
    expect(filterJourneys(journeys, { modes: ['train'] }, modeOf).map((j) => j.dep)).toEqual([at(480), at(520), at(540)])
    expect(filterJourneys(journeys, {}, modeOf)).toHaveLength(4)
  })

  it('lists the next ones from now, in published order', () => {
    expect(nextJourneys(journeys, at(500), 2, () => null).map((j) => j.dep)).toEqual([at(500), at(520)])
  })

  it('keeps a late service until its reported departure has passed', () => {
    const late = (j: (typeof journeys)[number]) => (j.dep === at(480) ? at(486) : null)
    expect(nextJourneys(journeys, at(484), 1, late)[0].dep).toBe(at(480))
    expect(nextJourneys(journeys, at(487), 1, late)[0].dep).toBe(at(500))
  })
})
