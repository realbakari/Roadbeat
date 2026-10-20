import { describe, expect, it } from 'vitest'
import { roadEvent } from '../test/fixtures'
import { dayLabel, holdOrder, snapshotOf } from './feedOrder'
import { buildPosts, type Post } from './posts'

const NOW = Date.parse('2026-10-20T04:00:00Z')
const H = 3_600_000

function posts(...specs: [id: number, published: number, updated?: number][]): Post[] {
  const events = specs.map(([id, published, updated]) => {
    const e = roadEvent(id, `Road ${id}`, `Town ${id}`)
    e.properties = { ...e.properties, published: new Date(published).toISOString(), last_updated: updated ? new Date(updated).toISOString() : null }
    return e
  })
  return buildPosts({ events, fires: null, warnings: null, alerts: null, stories: [], history: null, now: NOW })
}

describe('holdOrder', () => {
  it('keeps the order the reader saw and counts what is new or newly updated', () => {
    const before = posts([1, NOW - H], [2, NOW - 2 * H], [3, NOW - 3 * H])
    const after = posts([1, NOW - H], [2, NOW - 2 * H], [3, NOW - 3 * H, NOW - 10 * 60_000], [4, NOW - 5 * 60_000])
    const held = holdOrder(snapshotOf(before), after)
    expect(held.posts.map((p) => p.id)).toEqual(['road:1', 'road:2', 'road:3'])
    expect(held.posts[2].updated).toBe(NOW - 10 * 60_000)
    expect(held.waiting).toBe(2)
  })

  it('drops a post its publisher no longer lists', () => {
    const before = posts([1, NOW - H], [2, NOW - 2 * H])
    expect(holdOrder(snapshotOf(before), posts([1, NOW - H])).posts.map((p) => p.id)).toEqual(['road:1'])
  })
})

describe('dayLabel', () => {
  it('names days in Queensland time', () => {
    expect(dayLabel(NOW, NOW)).toBe('Today')
    // 11 pm on the 19th in Brisbane is 13:00 UTC on the 19th.
    expect(dayLabel(Date.parse('2026-10-19T13:00:00Z'), NOW)).toBe('Yesterday')
    expect(dayLabel(Date.parse('2026-10-16T02:00:00Z'), NOW)).toBe('Fri 16 Oct')
  })
})
