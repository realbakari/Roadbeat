import { describe, expect, it } from 'vitest'
import { fireWarning, gazetteerPlace, newsItem, roadEvent } from '../test/fixtures'
import { groupStories } from './newsStories'
import { officialNow } from './newsOfficial'

const NOW = Date.parse('2026-10-16T08:00:00+10:00')

describe('officialNow', () => {
  const [story] = groupStories([newsItem({ title: 'Crash, Burpengary East', places: [gazetteerPlace('Burpengary East', 'Moreton Bay'), gazetteerPlace('Kerry', 'Scenic Rim')] })])

  it('lists road events in effect whose QLDTraffic locality is a place the story names', () => {
    const events = [
      roadEvent(1, 'Bruce Highway', 'Burpengary East'),
      roadEvent(2, 'Beaudesert Nerang Road', 'Cainbable / Kerry'),
      roadEvent(3, 'Bruce Highway', 'Burpengary'),
      roadEvent(4, 'Bruce Highway', 'Burpengary East', {
        event_type: 'Roadworks',
        duration: { start: '2026-10-20T00:00:00+10:00', end: null, active_days: null, recurrences: null },
      }),
      roadEvent(5, 'Unknown', null),
    ]
    expect(officialNow(story, events, [], NOW).events.map((e) => e.properties.id)).toEqual([1, 2])
  })

  it('lists fires whose area, title or location names one of its places, as a whole word', () => {
    const fires = [fireWarning('a', 'Burpengary East and Narangba'), fireWarning('b', null, 'Bushfire near Kerry'), fireWarning('c', 'Kerrydale')]
    expect(officialNow(story, [], fires, NOW).fires.map((f) => f.id)).toEqual(['a', 'b'])
  })

  it('reports nothing for a story placed only by its source', () => {
    const [quake] = groupStories([newsItem({ kind: 'official', places: [{ name: 'Near Mount Larcom, QLD', lga: null, position: [0, 0], via: 'source' }] })])
    expect(officialNow(quake, [roadEvent(1, 'X', 'Mount Larcom')], [], NOW)).toEqual({ events: [], fires: [] })
  })
})
