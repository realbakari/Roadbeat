import { describe, expect, it } from 'vitest'
import type { EventHistory, HistoryEvent } from '../api/historyTypes'
import type { TransitAlert } from '../api/translink'
import type { TrafficEvent } from '../api/types'
import { fireWarning, newsItem, qldWarning, roadEvent } from '../test/fixtures'
import type { NewsStory } from './newsStories'
import { ACTIVE_WINDOW_MS, activityTimes, buildPosts, eventReplies, gatherRelated, issuedTime, laneOf, mostActive, postsFor, relatedPosts, shareText } from './posts'

const NOW = Date.parse('2026-10-20T04:00:00Z')
const iso = (t: number) => new Date(t).toISOString()
const H = 3_600_000

function event(id: number, published: number, updated: number | null, over: Partial<TrafficEvent['properties']> = {}): TrafficEvent {
  const e = roadEvent(id, 'Bruce Highway', 'Gympie')
  e.properties = { ...e.properties, published: iso(published), last_updated: updated == null ? null : iso(updated), ...over }
  return e
}

function version(id: number, updated: number, over: Partial<HistoryEvent> = {}): HistoryEvent {
  return { id, published: NOW - 5 * H, updated, type: 'Crash', priority: 'High', closure: false, anchor: null, road: 'Bruce Highway', spans: [[updated, updated]], ...over }
}

const history = (...versions: HistoryEvent[]): EventHistory => ({ runs: [], events: Object.fromEntries(versions.map((v) => [`${v.id}@${v.updated}`, v])) })

describe('issuedTime', () => {
  it("reads a warning's own issue time as Queensland time", () => {
    expect(issuedTime('Issued at 10:00am, Friday 16 October 2026')).toBe(Date.parse('2026-10-16T00:00:00Z'))
    expect(issuedTime('Issued at 3:45pm, Monday 19 October 2026')).toBe(Date.parse('2026-10-19T05:45:00Z'))
    expect(issuedTime('Issued at 12:05am, Monday 19 October 2026')).toBe(Date.parse('2026-10-18T14:05:00Z'))
  })

  it('gives null for text it cannot read, rather than guessing', () => {
    expect(issuedTime(null)).toBeNull()
    expect(issuedTime('Issued this morning')).toBeNull()
    expect(issuedTime('Issued at 10:00am, Friday 16 Octember 2026')).toBeNull()
  })
})

describe('eventReplies', () => {
  it('threads only the updates that changed a published type, priority or closure', () => {
    const e = event(1, NOW - 5 * H, NOW - H, { event_priority: 'Medium' })
    const replies = eventReplies(e, history(version(1, NOW - 4 * H), version(1, NOW - 3 * H), version(1, NOW - H, { priority: 'Medium', closure: true })))
    expect(replies).toEqual([{ at: NOW - H, text: 'Priority changed from High to Medium · Now filed as a road closure', by: null }])
  })

  it('threads nothing without a history to compare', () => {
    expect(eventReplies(event(1, NOW - 5 * H, NOW - H), null)).toEqual([])
  })
})

describe('road posts', () => {
  it('carry the latest update time when it is after publication, and order by it', () => {
    const early = event(1, NOW - 5 * H, NOW - 10 * 60_000)
    const late = event(2, NOW - H, null)
    const posts = buildPosts({ events: [late, early], fires: null, warnings: null, alerts: null, stories: [], history: null, now: NOW })
    expect(posts.map((p) => [p.id, p.updated])).toEqual([
      ['road:1', NOW - 10 * 60_000],
      ['road:2', null],
    ])
  })
})

describe('buildPosts', () => {
  const story: NewsStory = {
    id: 'abc-1',
    kind: 'news',
    items: [newsItem({ id: 'b', publisher: 'The Guardian', title: 'Second report', published: NOW - H }), newsItem({ id: 'a', publisher: 'ABC News', title: 'First report', published: NOW - 2 * H })],
    publishers: ['ABC News', 'The Guardian'],
    places: [],
    roads: [],
    areas: [],
    live: false,
    first: NOW - 2 * H,
    latest: NOW - H,
  }
  const alert = (start: number | null, end: number | null): TransitAlert => ({ id: 'SEQ-1', region: 'SEQ', header: 'Buses detour', description: '', url: null, cause: 'Construction', effect: 'Detour', routes: ['402'], stops: 0, stopIds: [], periods: [{ start, end }] })

  it('merges the sources, latest activity first, each under its own publisher and stamp', () => {
    const fire = { ...fireWarning('f1', 'Winton'), issued: NOW - 30 * 60_000 }
    const warning = { ...qldWarning('w1', 'Watch and Act', 'Isisford'), issued: 'Issued at 1:00pm, Tuesday 20 October 2026' }
    const posts = buildPosts({ events: [event(7, NOW - 4 * H, null)], fires: [fire], warnings: [warning], alerts: [alert(NOW - 6 * H, null)], stories: [story], history: null, now: NOW })
    expect(posts.map((p) => [p.id, p.stamp])).toEqual([
      ['fire:f1', 'Issued'],
      ['warning:w1', 'Issued'],
      ['news:abc-1', 'Reported'],
      ['road:7', 'Published'],
      ['transit:SEQ-1', 'In effect from'],
    ])
    expect(posts.find((p) => p.source === 'news')).toMatchObject({ publisher: 'ABC News', title: 'First report', replies: [{ at: NOW - H, text: 'Second report', by: 'The Guardian' }] })
    expect(posts.find((p) => p.source === 'warning')?.major).toBe(true)
  })

  it('leaves out what has no published time, and alerts not in effect now', () => {
    const posts = buildPosts({
      events: [event(8, NOW - H, null, { published: null })],
      fires: [fireWarning('f2', 'Longreach')],
      warnings: [qldWarning('w2', 'Advice', 'Barcaldine')],
      alerts: [alert(null, null), alert(NOW + H, null), alert(NOW - 3 * H, NOW - H)],
      stories: [],
      history: null,
      now: NOW,
    })
    expect(posts).toEqual([])
  })

  it('names the provider QLDTraffic credits for an event', () => {
    const e = event(9, NOW - H, null, { source: { source_name: 'TfNSW', source_id: null, account: null, provided_by: 'Transport for NSW', provided_by_url: null } })
    expect(buildPosts({ events: [e], fires: null, warnings: null, alerts: null, stories: [], history: null, now: NOW })[0]).toMatchObject({ publisher: 'QLDTraffic', handle: 'from Transport for NSW' })
  })
})

describe('postsFor', () => {
  it('keeps major items for Major and watched road events for Watching', () => {
    const red = event(1, NOW - H, null, { event_priority: 'Red Alert' })
    const plain = event(2, NOW - 2 * H, null)
    const posts = buildPosts({ events: [red, plain], fires: null, warnings: null, alerts: null, stories: [], history: null, now: NOW })
    expect(postsFor(posts, 'major', [], NOW).map((p) => p.id)).toEqual(['road:1'])
    expect(postsFor(posts, 'watching', [2], NOW).map((p) => p.id)).toEqual(['road:2'])
    expect(postsFor(posts, 'latest', [], NOW)).toHaveLength(2)
  })
})

describe('laneOf', () => {
  it('gives each publisher its own lane, so a run of one publisher reads as one line', () => {
    const posts = buildPosts({ events: [event(1, NOW - H, null), event(2, NOW - 2 * H, null)], fires: [{ ...fireWarning('f', 'Winton'), issued: NOW }], warnings: null, alerts: null, stories: [], history: null, now: NOW })
    const [fire, road1, road2] = posts
    expect(laneOf(road1)).toBe(laneOf(road2))
    expect(laneOf(fire)).not.toBe(laneOf(road1))
  })
})

describe('gatherRelated', () => {
  it('pulls posts on the same road and locality together under the newest, and leaves the rest alone', () => {
    const at = (id: number, road: string, locality: string, published: number) => {
      const e = roadEvent(id, road, locality)
      e.properties = { ...e.properties, published: iso(published) }
      return e
    }
    const posts = buildPosts({
      events: [at(1, 'Bruce Highway', 'Gympie', NOW - H), at(2, 'Ipswich Road', 'Annerley', NOW - 2 * H), at(3, 'Bruce Highway', 'Gympie', NOW - 3 * H), at(4, 'Bruce Highway', 'Cooroy', NOW - 4 * H)],
      fires: null,
      warnings: null,
      alerts: null,
      stories: [],
      history: null,
      now: NOW,
    })
    expect(gatherRelated(posts).map((e) => [e.post.id, e.joined])).toEqual([
      ['road:1', false],
      ['road:3', true],
      ['road:2', false],
      ['road:4', false],
    ])
    expect(relatedPosts(posts, posts[0]).map((p) => p.id)).toEqual(['road:3'])
  })
})

describe('shareText', () => {
  it('says what, who and when, in Queensland time', () => {
    const e = event(9, Date.parse('2026-10-20T00:30:00Z'), null, { source: { source_name: null, source_id: null, account: null, provided_by: 'Transport for NSW', provided_by_url: null } })
    const [p] = buildPosts({ events: [e], fires: null, warnings: null, alerts: null, stories: [], history: null, now: NOW })
    expect(shareText(p)).toBe('Bruce Highway. QLDTraffic (from Transport for NSW), published Tue, 20 Oct, 10:30 am AEST.')
  })
})

describe('mostActive', () => {
  const at = (id: number, road: string, locality: string, published: number, updated: number | null = null) => {
    const e = roadEvent(id, road, locality)
    e.properties = { ...e.properties, published: iso(published), last_updated: updated == null ? null : iso(updated) }
    return e
  }

  it('ranks roads by the posts and updates their publishers put out in the last 6 hours', () => {
    const posts = buildPosts({
      events: [
        at(1, 'Bruce Highway', 'Gympie', NOW - H, NOW - 10 * 60_000),
        at(2, 'Bruce Highway', 'Gympie', NOW - 2 * H),
        at(3, 'Ipswich Road', 'Annerley', NOW - 30 * 60_000),
        at(4, 'Warrego Highway', 'Roma', NOW - 30 * H, NOW - 20 * H),
      ],
      fires: null,
      warnings: null,
      alerts: null,
      stories: [],
      history: null,
      now: NOW,
    })
    const ranked = mostActive(posts, NOW)
    expect(ranked.map((t) => [t.name, t.count, t.posts.map((p) => p.id)])).toEqual([
      ['Bruce Highway, Gympie', 3, ['road:1', 'road:2']],
      ['Ipswich Road, Annerley', 1, ['road:3']],
    ])
    expect(postsFor(posts, 'active', [], NOW).map((p) => p.id)).toEqual(['road:1', 'road:2', 'road:3'])
  })

  it('counts a publisher time once, and nothing older than the window', () => {
    const [p] = buildPosts({ events: [at(1, 'A', 'B', NOW - ACTIVE_WINDOW_MS - 1, NOW - H)], fires: null, warnings: null, alerts: null, stories: [], history: null, now: NOW })
    expect(activityTimes({ ...p, replies: [{ at: NOW - H, text: 'x', by: null }] }, NOW - ACTIVE_WINDOW_MS)).toEqual([NOW - H])
  })
})
