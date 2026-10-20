import { describe, expect, it } from 'vitest'
import { fireWarning, roadEvent } from '../test/fixtures'
import { buildPosts } from './posts'
import { groupResults, searchPosts } from './postSearch'

const NOW = Date.parse('2026-10-20T04:00:00Z')
const H = 3_600_000

function road(id: number, name: string, locality: string, published: number, description: string | null = null) {
  const e = roadEvent(id, name, locality)
  e.properties = { ...e.properties, published: new Date(published).toISOString(), description }
  return e
}

const posts = buildPosts({
  events: [road(1, 'Bruce Highway', 'Gympie', NOW - 2 * H), road(2, 'Ipswich Road', 'Annerley', NOW - H, 'Water main repairs near the Bruce Highway exit'), road(3, 'Bruce Highway', 'Cooroy', NOW - 3 * H)],
  fires: [{ ...fireWarning('f1', 'Gympie'), issued: NOW - 30 * 60_000 }],
  warnings: null,
  alerts: null,
  stories: [],
  history: null,
  now: NOW,
})

describe('searchPosts', () => {
  it('needs every word, puts title matches first, then the latest activity', () => {
    expect(searchPosts(posts, 'bruce highway').map((p) => p.id)).toEqual(['road:1', 'road:3', 'road:2'])
    expect(searchPosts(posts, 'bruce gympie').map((p) => p.id)).toEqual(['road:1'])
  })

  it("finds a post by the publisher's reference and full text, ignoring case and punctuation", () => {
    expect(searchPosts(posts, '#2').map((p) => p.id)).toEqual(['road:2'])
    expect(searchPosts(posts, 'WATER, main').map((p) => p.id)).toEqual(['road:2'])
  })

  it('matches nothing for an empty query', () => {
    expect(searchPosts(posts, '  ')).toEqual([])
  })
})

describe('groupResults', () => {
  it('groups by source in a fixed order and says how many more there are', () => {
    const groups = groupResults(searchPosts(posts, 'gympie'), 1)
    expect(groups.map((g) => [g.label, g.posts.map((p) => p.id), g.more])).toEqual([
      ['Bushfires', ['fire:f1'], 0],
      ['Road events', ['road:1'], 0],
    ])
  })
})
