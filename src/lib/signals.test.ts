import { describe, expect, it } from 'vitest'
import { dsColor, loadChanged, siteLoad } from './signals'

describe('siteLoad', () => {
  it('takes the busiest lane and counts every vehicle in the latest cycle', () => {
    const load = siteLoad([
      { id: 'SA-1', recorded: 1, cycle: 90, lanes: [{ ds: 40, vehicles: 6 }, { ds: 92, vehicles: 9 }] },
      { id: 'SA-2', recorded: 2, cycle: 90, lanes: [{ ds: 10, vehicles: 1 }] },
    ])
    expect(load).toEqual({ maxDs: 92, vehicles: 16, recorded: 2 })
  })
})

describe('dsColor', () => {
  it('steps from green to red as saturation rises', () => {
    expect(dsColor(10)).toBe('#16a34a')
    expect(dsColor(60)).toBe('#ca8a04')
    expect(dsColor(85)).toBe('#ea580c')
    expect(dsColor(120)).toBe('#dc2626')
  })
})

describe('loadChanged', () => {
  it('points out moves of 10 points or more, or into another colour band', () => {
    expect(loadChanged(40, 52)).toBe(true)
    expect(loadChanged(48, 51)).toBe(true)
    expect(loadChanged(60, 66)).toBe(false)
    expect(loadChanged(30, 30)).toBe(false)
  })
})
