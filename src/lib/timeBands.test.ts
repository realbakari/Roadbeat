import { describe, expect, it } from 'vitest'
import { at } from '../test/fixtures'
import { bandOf, lastServices } from './timeBands'

describe('bandOf', () => {
  it('splits the Brisbane day into morning, afternoon and night', () => {
    expect(bandOf(at(3 * 60 + 59))).toBe('night')
    expect(bandOf(at(4 * 60))).toBe('am')
    expect(bandOf(at(11 * 60 + 59))).toBe('am')
    expect(bandOf(at(12 * 60))).toBe('pm')
    expect(bandOf(at(18 * 60 + 59))).toBe('pm')
    expect(bandOf(at(19 * 60))).toBe('night')
    expect(bandOf(at(24 * 60 + 30))).toBe('night')
  })
})

describe('lastServices', () => {
  it('marks the latest departure on each route and direction', () => {
    const list = [
      { key: 'a', route: '66', dir: 0, t: 480 },
      { key: 'b', route: '66', dir: 0, t: 1380 },
      { key: 'c', route: '66', dir: 1, t: 1200 },
      { key: 'd', route: 'T1', dir: 0, t: 1430 },
    ]
    const last = lastServices(list, (d) => `${d.route}/${d.dir}`, (d) => d.t, (d) => d.key)
    expect([...last].sort()).toEqual(['b', 'c', 'd'])
  })
})
