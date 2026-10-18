import { describe, expect, it } from 'vitest'
import type { FireWarning } from '../api/bushfires'
import type { TransitAlert } from '../api/translink'
import { eventNotices, eventSignatures, fireLevels, fireNotices, newsNotices, transitNotices } from './alertNotices'
import { DEFAULT_SETTINGS, type AlertSettings } from './alertRules'
import { groupStories } from './newsStories'
import { fireWarning, gazetteerPlace, newsItem, roadEvent } from '../test/fixtures'

const now = Date.parse('2026-10-18T00:00:00Z')
const settings = (over: Partial<AlertSettings> = {}): AlertSettings => ({ ...DEFAULT_SETTINGS, ...over })

describe('eventNotices', () => {
  const crash = roadEvent(1, 'Bruce Highway', 'Caboolture')
  const works = roadEvent(2, 'Ipswich Road', 'Annerley', { event_type: 'Roadworks' })

  it('raises a new event the rules match, not one they skip or one already seen', () => {
    const out = eventNotices({}, [crash, works], settings(), now, false)
    expect(out.map((n) => [n.kind, n.href, n.tone])).toEqual([['event-new', 'event/1', 'error']])
    expect(eventNotices(eventSignatures([crash]), [crash], settings(), now, false)).toEqual([])
  })

  it('raises a new event the user already watches, whatever the rules say', () => {
    expect(eventNotices({}, [works], settings({ watchedEvents: [2] }), now, false).map((n) => n.href)).toEqual(['event/2'])
  })

  it('tells a watcher when their event changes, and when it is no longer listed', () => {
    const before = eventSignatures([crash, works])
    const reopened = { ...works, properties: { ...works.properties, status: 'Reopened' } }
    const out = eventNotices(before, [reopened], settings({ watchedEvents: [1, 2] }), now, false)
    expect(out.map((n) => [n.kind, n.tone])).toEqual([
      ['event-update', 'success'],
      ['event-cleared', 'success'],
    ])
    expect(out[0].title).toMatch(/^Road reopened · /)
  })

  it('caps alerts raised for changes made while away', () => {
    const many = Array.from({ length: 30 }, (_, i) => roadEvent(100 + i, 'Bruce Highway', 'Caboolture'))
    const out = eventNotices({}, many, settings(), now, true)
    expect(out).toHaveLength(20)
    expect(out.every((n) => n.away)).toBe(true)
  })
})

describe('transitNotices', () => {
  const alert = (id: string, routes: string[]): TransitAlert => ({
    id,
    region: 'SEQ',
    header: 'Stop closed',
    description: 'Use the temporary stop.',
    url: null,
    cause: 'Construction',
    effect: 'Detour',
    routes,
    stops: 1,
    stopIds: [],
    periods: [{ start: null, end: null }],
  })

  it('raises only unseen alerts that name a watched route', () => {
    const out = transitNotices(['a'], [alert('a', ['402']), alert('b', ['402']), alert('c', ['60'])], ['402'], now, false)
    expect(out).toEqual([
      { id: 'tl-b', kind: 'transit', title: '402: Stop closed', body: 'Detour. Use the temporary stop.', at: now, href: 'transit/alert/b', tone: 'warning', away: false },
    ])
  })

  it('says when an alert that has not started yet begins', () => {
    const later = { ...alert('d', ['402']), periods: [{ start: now + 86_400_000, end: null }] }
    expect(transitNotices([], [later], ['402'], now, false)[0].body).toBe('Starts Mon, 19 Oct, 10:00 am. Detour.')
  })
})

describe('fireNotices', () => {
  const watch: FireWarning = { ...fireWarning('W1', 'Upper Coomera'), level: 'Watch and Act', levelText: 'Watch and Act' }

  it('raises a new warning, and one whose level rose, but not one that held or fell', () => {
    const advice = fireWarning('W1', 'Upper Coomera')
    expect(fireNotices({}, [advice], settings(), now, false).map((n) => n.title)).toEqual(['Advice: Upper Coomera'])
    expect(fireNotices(fireLevels([advice]), [watch], settings(), now, false).map((n) => [n.title, n.tone])).toEqual([['Now Watch and Act: Upper Coomera', 'error']])
    expect(fireNotices(fireLevels([advice]), [advice], settings(), now, false)).toEqual([])
    expect(fireNotices(fireLevels([watch]), [advice], settings(), now, false)).toEqual([])
  })

  it('skips warnings the rules exclude', () => {
    expect(fireNotices({}, [watch], settings({ kinds: { ...DEFAULT_SETTINGS.kinds, bushfire: false } }), now, false)).toEqual([])
  })
})

describe('newsNotices', () => {
  const stories = groupStories([
    newsItem({
      source: 'qps',
      publisher: 'Queensland Police',
      kind: 'official',
      title: 'Serious traffic crash, Mount Byron',
      summary: 'Emergency services were called to Mount Byron Road.',
      places: [gazetteerPlace('Mount Byron', 'Somerset Regional', [152.65, -27.13])],
    }),
  ])
  const on = settings({ kinds: { ...DEFAULT_SETTINGS.kinds, newsOfficial: true } })

  it('raises an unseen story the rules match, in the publisher\'s words', () => {
    const [n] = newsNotices([], stories, on, now, false)
    expect(n).toMatchObject({ kind: 'news', title: 'Queensland Police: Serious traffic crash, Mount Byron', body: 'Emergency services were called to Mount Byron Road.', tone: 'warning' })
    expect(newsNotices([stories[0].id], stories, on, now, false)).toEqual([])
    expect(newsNotices([], stories, settings(), now, false)).toEqual([])
  })
})
