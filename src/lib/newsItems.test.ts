import { describe, expect, it } from 'vitest'
import type { RssItem } from '../api/newsFeeds'
import { NEWS_SOURCES } from '../api/newsSources'
import { fromBomWarning, fromBulletin, fromQuake, fromRss, itemId, KEEP_MS, mergeItems } from './newsItems'
import { placeIndex } from './newsPlaces'
import { newsItem } from '../test/fixtures'

const source = (id: string) => NEWS_SOURCES.find((s) => s.id === id)!
const index = placeIndex([
  ['Burpengary East', 153.0, -27.15, 'Moreton Bay'],
  ['Brisbane', 153.02, -27.47, 'Brisbane City'],
  ['Annerley', 153.03, -27.51, 'Brisbane City'],
])
const NOW = Date.parse('2026-10-16T08:00:00+10:00')

const rss = (o: Partial<RssItem> = {}): RssItem => ({
  title: 'Serious traffic crash charges, Burpengary East',
  link: 'https://mypolice.qld.gov.au/news/2026/10/16/x/',
  published: NOW - 60_000,
  description: '<p>A man has been charged after a crash. It will be alleged a motorbike lost control at Annerley.</p>',
  categories: [],
  ...o,
})

describe('fromRss', () => {
  it("keeps an openly licensed source's whole summary, and locates from all of it", () => {
    expect(fromRss(source('qps'), [rss()], index, NOW)).toEqual([
      {
        id: itemId('https://mypolice.qld.gov.au/news/2026/10/16/x/'),
        source: 'qps',
        publisher: 'Queensland Police',
        kind: 'official',
        title: 'Serious traffic crash charges, Burpengary East',
        link: 'https://mypolice.qld.gov.au/news/2026/10/16/x/',
        published: NOW - 60_000,
        updated: null,
        summary: 'A man has been charged after a crash. It will be alleged a motorbike lost control at Annerley.',
        places: [
          { name: 'Burpengary East', lga: 'Moreton Bay', position: [153.0, -27.15], via: 'gazetteer' },
          { name: 'Annerley', lga: 'Brisbane City', position: [153.03, -27.51], via: 'gazetteer' },
        ],
        roads: [],
        area: null,
      },
    ])
  })

  it("keeps only a news outlet's first sentence, and locates from that alone", () => {
    const [it] = fromRss(source('7news-qld'), [rss({ title: 'Crash, Burpengary East' })], index, NOW)
    expect(it.summary).toBe('A man has been charged after a crash.')
    expect(it.places.map((p) => p.name)).toEqual(['Burpengary East'])
  })

  it('drops undated and far-future items rather than dating them', () => {
    expect(fromRss(source('qps'), [rss({ published: null }), rss({ published: NOW + 60 * 60_000 })], index, NOW)).toEqual([])
  })

  it('keeps only Queensland items from national feeds', () => {
    const items = [rss({ title: 'Trump cancels livestream', description: 'A poll found.' }), rss({ title: 'Storms for south-east Queensland', link: 'https://x.com/a' })]
    expect(fromRss(source('sbs'), items, index, NOW).map((i) => i.title)).toEqual(['Storms for south-east Queensland'])
  })

  it('leaves the summary out when it only repeats the headline', () => {
    expect(fromRss(source('7news-qld'), [rss({ title: 'Ferry plan slammed.', description: 'Ferry plan slammed.' })], index, NOW)[0].summary).toBeNull()
  })
})

describe('fromBomWarning and fromQuake', () => {
  it("keeps a BoM warning's headline and links to the BoM's warnings page", () => {
    const w = fromBomWarning(source('bom'), { id: 'IDQ20002', headline: 'Road Weather Alert for Slippery Roads for Brisbane', issued: NOW, expires: null }, index)
    expect(w).toMatchObject({ kind: 'official', summary: null, link: 'https://www.bom.gov.au/location/australia/queensland/warnings' })
    expect(w.places.map((p) => p.name)).toEqual(['Brisbane'])
  })

  it("places an earthquake at GA's published epicentre", () => {
    const q = fromQuake(source('ga-quakes'), { id: 'ga1', magnitude: '2.3', magnitudeType: 'MLa075', place: 'Near Mount Larcom, QLD', at: NOW, position: [151, -23.8] }, 'https://ga/1')
    expect(q.title).toBe('Magnitude 2.3 earthquake, Near Mount Larcom, QLD')
    expect(q.places).toEqual([{ name: 'Near Mount Larcom, QLD', lga: null, position: [151, -23.8], via: 'source' }])
  })
})

describe('mergeItems', () => {
  const it_ = (id: string, source: string, published: number) => newsItem({ id, source, published })

  it('replaces earlier copies, keeps items from sources that failed, and drops old items', () => {
    const prev = [it_('a', 'abc-qld', NOW - 60_000), it_('b', 'sbs', NOW - 60_000), it_('old', 'sbs', NOW - KEEP_MS - 1)]
    const fresh = [{ ...it_('a', 'abc-qld', NOW - 60_000), title: 'updated' }]
    const merged = mergeItems(prev, fresh, new Set(['abc-qld']), NOW)
    expect(merged.map((i) => i.id)).toEqual(['a', 'b'])
    expect(merged[0].title).toBe('updated')
  })

  it('drops BoM warnings the BoM no longer lists', () => {
    expect(mergeItems([it_('w', 'bom', NOW)], [], new Set(['bom']), NOW)).toEqual([])
    expect(mergeItems([it_('w', 'bom', NOW)], [], new Set(), NOW)).toHaveLength(1)
  })
})

describe('mergeItems with updates', () => {
  const base = newsItem({ id: 'live', title: 'Live: Queensland votes', published: NOW - 60 * 60_000 })

  it('keeps the first date and records a later publisher date as an update', () => {
    const [merged] = mergeItems([base], [{ ...base, published: NOW - 5 * 60_000 }], new Set(['abc-qld']), NOW)
    expect([merged.published, merged.updated]).toEqual([NOW - 60 * 60_000, NOW - 5 * 60_000])
  })

  it('leaves an unchanged item without an update, and never moves an update backwards', () => {
    expect(mergeItems([base], [base], new Set(['abc-qld']), NOW)[0].updated).toBeNull()
    const updated = { ...base, updated: NOW - 5 * 60_000 }
    expect(mergeItems([updated], [base], new Set(['abc-qld']), NOW)[0].updated).toBe(NOW - 5 * 60_000)
  })

  it('keeps a live blog updated within 48 hours even if it started earlier', () => {
    const old = { ...base, published: NOW - KEEP_MS - 60 * 60_000, updated: NOW - 60 * 60_000 }
    expect(mergeItems([old], [], new Set(), NOW)).toHaveLength(1)
  })
})

describe('fromBulletin', () => {
  const somerset = { council: 'Somerset Regional Council', area: 'Somerset Regional', page: 'https://disaster.somerset.qld.gov.au', feed: 'https://disaster.somerset.qld.gov.au' }
  const bulletin = { title: 'Flood siren testing in Lowood', description: '<p>Council will test its sirens on Thursday. The sirens sound for one minute.</p>', created: NOW - 60_000, updated: NOW }

  it("files a council's update as an official item: title, whole text, its area, linked to its dashboard", () => {
    expect(fromBulletin(somerset, bulletin, index)).toMatchObject({
      publisher: 'Somerset Regional Council',
      kind: 'official',
      link: 'https://disaster.somerset.qld.gov.au',
      published: NOW - 60_000,
      updated: NOW,
      summary: 'Council will test its sirens on Thursday. The sirens sound for one minute.',
      area: 'Somerset Regional',
    })
  })

  it('gives the same bulletin the same id on every read, whatever the platform calls it', () => {
    expect(fromBulletin(somerset, bulletin, index).id).toBe(fromBulletin(somerset, { ...bulletin, updated: null }, index).id)
  })
})
