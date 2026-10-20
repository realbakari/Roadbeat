import { describe, expect, it } from 'vitest'
import type { TransitAlert } from '../api/translink'
import { fireWarning, newsItem, qldWarning, roadEvent } from '../test/fixtures'
import type { NewsStory } from './newsStories'
import { fireDetail, newsDetail, roadDetail, transitDetail, warningDetail } from './postDetails'

describe('roadDetail', () => {
  it("keeps QLDTraffic's own text under its own headings, and times in Queensland time", () => {
    const e = roadEvent(1, 'Bruce Highway', 'Gympie')
    e.properties = { ...e.properties, description: 'Crash involving two vehicles', advice: 'Avoid the area', published: '2026-10-20T00:30:00Z', last_updated: null }
    const d = roadDetail(e)
    expect(d.sections).toEqual([
      { title: 'Description', text: 'Crash involving two vehicles' },
      { title: 'Advice', text: 'Avoid the area' },
    ])
    expect(d.facts).toContainEqual(['Road', 'Bruce Highway'])
    expect(d.facts).toContainEqual(['Published', 'Tue, 20 Oct, 10:30 am AEST'])
    expect(d.facts.map(([k]) => k)).not.toContain('Last updated')
  })
})

describe('fireDetail and warningDetail', () => {
  it("list only the parts the publisher filled in", () => {
    const f = { ...fireWarning('f1', 'Winton'), callToAction: 'Stay informed', impacts: null }
    expect(fireDetail(f).sections).toEqual([{ title: 'What to do now', text: 'Stay informed' }])
    const w = { ...qldWarning('w1', 'Advice', 'Isisford'), shouldDo: 'Monitor conditions', issued: 'Issued at 10:00am, Friday 16 October 2026' }
    expect(warningDetail(w).sections).toEqual([{ title: 'What you should do', text: 'Monitor conditions' }])
    expect(warningDetail(w).facts).toContainEqual(['Issued', 'Issued at 10:00am, Friday 16 October 2026'])
  })
})

describe('transitDetail', () => {
  it("names an open-ended period as Translink leaves it", () => {
    const a: TransitAlert = { id: 'SEQ-1', region: 'SEQ', header: 'Detour', description: 'Buses detour via Main St.', url: null, cause: 'Construction', effect: 'Detour', routes: ['402', '403'], stops: 2, stopIds: [], periods: [{ start: Date.parse('2026-10-20T00:00:00Z'), end: null }] }
    const d = transitDetail(a)
    expect(d.facts).toContainEqual(['In effect', 'Tue, 20 Oct, 10:00 am AEST to until further notice'])
    expect(d.facts).toContainEqual(['Routes', '402, 403'])
    expect(d.sections).toEqual([{ title: 'Details', text: 'Buses detour via Main St.' }])
  })
})

describe('newsDetail', () => {
  it("lists every report with its publisher and link", () => {
    const s: NewsStory = {
      id: 'x',
      kind: 'news',
      items: [newsItem({ id: 'b', publisher: 'ABC News', title: 'Later', link: 'https://www.abc.net.au/b', published: 2 }), newsItem({ id: 'a', publisher: '7NEWS', title: 'First', link: 'https://7news.com.au/a', published: 1 })],
      publishers: ['7NEWS', 'ABC News'],
      places: [],
      roads: [],
      areas: [],
      live: false,
      first: 1,
      latest: 2,
    }
    expect(newsDetail(s).reports.map((r) => [r.publisher, r.title, r.link])).toEqual([
      ['ABC News', 'Later', 'https://www.abc.net.au/b'],
      ['7NEWS', 'First', 'https://7news.com.au/a'],
    ])
  })
})
