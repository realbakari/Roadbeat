import { describe, expect, it } from 'vitest'
import type { NewsItem } from '../api/newsTypes'
import { gazetteerPlace, newsItem } from '../test/fixtures'
import { filterStories, groupStories, headlineStories, isLiveBlog, storyBounds, publisherList, reportedAgo, sameStory, storyLocatedLine, storyRegions, storySourceLine, titleWords, DEFAULT_STORY_FILTER } from './newsStories'

const H = 60 * 60_000
const T0 = Date.parse('2026-10-16T08:00:00+10:00')

function item(id: string, publisher: string, title: string, at: number, extra: Partial<NewsItem> = {}): NewsItem {
  return newsItem({ id, source: publisher.toLowerCase(), publisher, title, published: at, ...extra })
}

describe('sameStory', () => {
  it('matches headlines that share most of their content words', () => {
    expect(
      sameStory(
        titleWords('Brisbane man dies at home after waiting two hours for ambulance as Queensland Ambulance Service faces mounting pressure'),
        titleWords('Review ordered after man dies waiting two hours for ambulance'),
      ),
    ).toBe(true)
  })

  it("doesn't match headlines that only share common words", () => {
    expect(sameStory(titleWords('Man charged after crash at Burpengary'), titleWords('Man charged after Gympie assault'))).toBe(false)
  })
})

describe('groupStories', () => {
  const ambo1 = item('a', 'ABC', 'Review ordered after man dies waiting two hours for ambulance', T0)
  const ambo2 = item('b', '7NEWS', 'Brisbane man dies waiting two hours for ambulance', T0 + H)
  const ambo3 = item('c', 'Brisbane Times', 'Ambulance wait: man dies after two hours waiting', T0 + 2 * H)
  const other = item('d', 'ABC', 'Weekend storms and showers forecast for parts of Queensland', T0 + 30 * 60_000)

  it('groups reports of one story and counts each publisher once', () => {
    const abcAgain = item('e', 'ABC', 'Man dies waiting two hours for ambulance, review ordered', T0 + 3 * H)
    const stories = groupStories([ambo3, other, ambo1, ambo2, abcAgain])
    expect(stories.map((s) => s.items.map((i) => i.id))).toEqual([['e', 'c', 'b', 'a'], ['d']])
    expect(stories[0].id).toBe('a')
    expect(stories[0].publishers).toEqual(['ABC', '7NEWS', 'Brisbane Times'])
    expect(publisherList(stories[0].publishers)).toBe('ABC, 7NEWS and Brisbane Times')
  })

  it('treats the same link in two feeds as one report', () => {
    const copy = { ...ambo1, id: 'a2', source: 'abc-brisbane' }
    expect(groupStories([ambo1, copy])[0].items).toHaveLength(1)
  })

  it('keeps reports more than 12 hours apart separate', () => {
    expect(groupStories([ambo1, { ...ambo2, published: T0 + 13 * H }])).toHaveLength(2)
  })

  it('never groups official items, even with matching headlines or a shared link', () => {
    const police = item('p', 'Queensland Police', 'Man dies waiting two hours for ambulance', T0 + H, { kind: 'official' })
    const bom1 = item('w1', 'Bureau of Meteorology', 'Severe Thunderstorm Warning for Darling Downs', T0, { kind: 'official', link: 'https://bom' })
    const bom2 = item('w2', 'Bureau of Meteorology', 'Severe Thunderstorm Warning for Wide Bay', T0, { kind: 'official', link: 'https://bom' })
    const stories = groupStories([ambo1, police, bom1, bom2])
    expect(stories).toHaveLength(4)
    expect(stories.find((s) => s.id === 'a')!.publishers).toEqual(['ABC'])
  })

  it('collects the places matched across its reports', () => {
    const toowoomba = { name: 'Toowoomba', lga: 'Toowoomba Regional', position: [151.95, -27.56] as [number, number], via: 'gazetteer' as const }
    const brisbane = { name: 'Brisbane', lga: 'Brisbane City', position: [153.02, -27.47] as [number, number], via: 'gazetteer' as const }
    const [s] = groupStories([
      { ...ambo1, places: [toowoomba] },
      { ...ambo2, places: [brisbane, toowoomba] },
    ])
    expect(s.places.map((p) => p.name)).toEqual(['Toowoomba', 'Brisbane'])
  })
})

describe('filterStories and storyRegions', () => {
  const place = (name: string, lga: string) => ({ name, lga, position: [0, 0] as [number, number], via: 'gazetteer' as const })
  const stories = groupStories([
    item('a', 'ABC', 'Crash closes Warrego Highway near Toowoomba', T0, { places: [place('Toowoomba', 'Toowoomba Regional')] }),
    item('b', '7NEWS', 'Ferry bar plan slammed by unions', T0 + H),
    item('c', 'Queensland Police', 'Serious traffic crash, Burpengary East', T0 + 2 * H, { kind: 'official', places: [place('Burpengary East', 'Moreton Bay')] }),
  ])

  it('filters by council area, unlocated, outlet and kind', () => {
    const ids = (f: Partial<typeof DEFAULT_STORY_FILTER>, now = T0 + 3 * H) => filterStories(stories, { ...DEFAULT_STORY_FILTER, ...f }, now).map((s) => s.id)
    expect(ids({})).toEqual(['c', 'b', 'a'])
    expect(ids({ region: 'Toowoomba Regional' })).toEqual(['a'])
    expect(ids({ region: 'unlocated' })).toEqual(['b'])
    expect(ids({ outlet: '7NEWS' })).toEqual(['b'])
    expect(ids({ kind: 'official' })).toEqual(['c'])
    expect(ids({ query: 'warrego toowoomba' })).toEqual(['a'])
    expect(ids({ query: 'police' })).toEqual(['c'])
    expect(ids({ hours: 6 }, T0 + 6.5 * H)).toEqual(['c', 'b'])
    expect(ids({ place: 'Burpengary East' })).toEqual(['c'])
  })

  it('counts stories per council area', () => {
    expect(storyRegions(stories)).toEqual([
      { lga: 'Moreton Bay', count: 1 },
      { lga: 'Toowoomba Regional', count: 1 },
    ])
  })
})

describe('storySourceLine and storyLocatedLine', () => {
  const at: [number, number] = [0, 0]
  it('labels news as reports and official items by agency, and says what located them', () => {
    const [news] = groupStories([
      item('a', 'ABC', 'Crash closes Warrego Highway near Toowoomba', T0, { places: [{ name: 'Toowoomba', lga: 'Toowoomba Regional', position: at, via: 'gazetteer' }] }),
      item('b', '7NEWS', 'Warrego Highway crash closes road near Toowoomba', T0 + H),
    ])
    expect(storySourceLine(news)).toBe('News report · Reported by ABC and 7NEWS')
    expect(storyLocatedLine(news)).toBe('Located from: Toowoomba')
    const [onRoad] = groupStories([
      item('r', 'Queensland Police', 'Crash, Burpengary East and Narangba', T0, {
        kind: 'official',
        places: [gazetteerPlace('Burpengary East', 'Moreton Bay'), gazetteerPlace('Narangba', 'Moreton Bay')],
        roads: [{ name: 'Avaline Boulevard', locality: 'Burpengary East', lga: 'Moreton Bay', lines: [] }],
      }),
    ])
    expect(storyLocatedLine(onRoad)).toBe('Located from: Avaline Boulevard, Burpengary East; Narangba')
    const [quake] = groupStories([
      item('q', 'Geoscience Australia', 'Magnitude 2.3 earthquake, Near Mount Larcom, QLD', T0, { kind: 'official', places: [{ name: 'Near Mount Larcom, QLD', lga: null, position: at, via: 'source' }] }),
    ])
    expect(storySourceLine(quake)).toBe('Official · Geoscience Australia')
    expect(storyLocatedLine(quake)).toBe('Location from Geoscience Australia')
    const [single] = groupStories([item('c', 'ABC', 'Rates on hold', T0)])
    expect(storySourceLine(single)).toBe('News report · ABC')
    expect(storyLocatedLine(single)).toBeNull()
  })
})

describe('headlineStories', () => {
  it('puts recent stories carried by more outlets first, then the newest', () => {
    const now = T0 + 5 * H
    const stories = groupStories([
      item('a', 'ABC', 'Review ordered after man dies waiting two hours for ambulance', T0),
      item('b', '7NEWS', 'Brisbane man dies waiting two hours for ambulance', T0 + H),
      item('c', 'ABC', 'Ferry bar plan slammed by unions', T0 + 4 * H),
      item('d', 'ABC', 'Weekend storms forecast', T0 + 3 * H),
    ])
    expect(headlineStories(stories, now, 3).map((s) => s.id)).toEqual(['a', 'c', 'd'])
    expect(headlineStories(stories, now + 10 * H, 1).map((s) => s.id)).toEqual(['c'])
  })
})

describe('isLiveBlog and live stories', () => {
  it("follows each publisher's own marking", () => {
    expect(isLiveBlog({ title: 'Live: ASX set to rise', link: 'https://www.abc.net.au/news/2026-10-16/asx-markets-live-updates-oct-16/1' })).toBe(true)
    expect(isLiveBlog({ title: 'ADF member a person of interest', link: 'https://www.theguardian.com/australia-news/live/2026/oct/15/x' })).toBe(true)
    expect(isLiveBlog({ title: 'Trump cancels livestream', link: 'https://www.sbs.com.au/news/article/donald-trump-livestream-execution/1' })).toBe(false)
    expect(isLiveBlog({ title: 'Parcel delivery delays', link: 'https://example.com/news/delivery-delays' })).toBe(false)
  })

  it('marks a story live when any report is a live blog, and filters to them', () => {
    const stories = groupStories([item('a', 'ABC', 'Live: Queensland election day', T0), item('b', 'ABC', 'Rates on hold', T0)])
    expect(stories.map((s) => [s.id, s.live])).toEqual([['a', true], ['b', false]])
    expect(filterStories(stories, { ...DEFAULT_STORY_FILTER, live: true }, T0).map((s) => s.id)).toEqual(['a'])
  })
})

describe('updated reports', () => {
  it("dates a story by its publisher's latest update and lists that report first", () => {
    const [s] = groupStories([
      item('a', 'ABC', 'Review ordered after man dies waiting two hours for ambulance', T0, { updated: T0 + 5 * H }),
      item('b', '7NEWS', 'Brisbane man dies waiting two hours for ambulance', T0 + H),
    ])
    expect(s.latest).toBe(T0 + 5 * H)
    expect(s.items.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('says "Updated" only when the publisher moved the date', () => {
    expect(reportedAgo(true, T0, T0 + 5 * 60_000)).toBe('Updated 5 minutes ago')
    expect(reportedAgo(false, T0, T0 + 2 * H)).toBe('2 hours ago')
  })
})

describe('storyBounds', () => {
  it('shows the first road, else the first place, else nothing', () => {
    const toowoomba = gazetteerPlace('Toowoomba', 'Toowoomba Regional', [151.95, -27.56])
    const road = { name: 'James Street', locality: 'Toowoomba', lga: 'Toowoomba Regional', lines: [[[151.9, -27.6], [152.0, -27.5]] as [number, number][]] }
    expect(storyBounds(groupStories([item('a', 'ABC', 'x', T0, { places: [toowoomba], roads: [road] })])[0])).toEqual([[151.9, -27.6], [152.0, -27.5]])
    expect(storyBounds(groupStories([item('a', 'ABC', 'x', T0, { places: [toowoomba] })])[0])).toEqual([[151.95, -27.56], [151.95, -27.56]])
    expect(storyBounds(null)).toBeNull()
  })
})
