import { describe, expect, it } from 'vitest'
import { fireWarning, newsItem, qldWarning, roadEvent } from '../test/fixtures'
import { cardDescription, cardPath, cardSharePage, fireCard, missingCard, newsCard, roadCard, warningCard } from './shareCard'

describe('share cards', () => {
  it("carry a road event's own words, its latest time in Queensland time and QLDTraffic's credit", () => {
    const e = roadEvent(835338, 'Marian Eton Road', 'North Eton')
    e.properties = { ...e.properties, event_type: 'Flooding', event_priority: 'High', published: '2026-10-19T23:00:00Z', last_updated: '2026-10-20T03:42:00Z' }
    const c = roadCard(e)
    expect(c).toMatchObject({ path: '/timeline/road/835338', title: 'Marian Eton Road', publisher: 'QLDTraffic', handle: 'Transport and Main Roads', when: 'Updated Tue, 20 Oct, 1:42 pm AEST' })
    expect(c.level?.text).toBe('High')
    expect(c.credit).toContain('CC BY 4.0')
  })

  it("use a warning's issue time as written, and name who issued it", () => {
    const w = { ...qldWarning('HN_1', 'Advice', 'Isisford'), from: 'Longreach Regional Council', issued: 'Issued at 05:30pm, Monday 16 October 2026' }
    expect(warningCard(w)).toMatchObject({ publisher: 'Longreach Regional Council', handle: 'via Queensland Disaster Management', when: 'Issued at 05:30pm, Monday 16 October 2026' })
    expect(fireCard(fireWarning('F/1', 'Winton')).path).toBe('/timeline/fire/F%2F1')
  })

  it("keep a news story to its first report's headline and licensed summary", () => {
    const c = newsCard(newsItem({ id: 'abc', publisher: 'ABC News', title: 'Storms ahead', summary: 'Rain is forecast.' }))
    expect(c).toMatchObject({ title: 'Storms ahead', description: 'Rain is forecast.', publisher: 'ABC News', kind: 'News report' })
  })

  it("say so when the post can't be found, rather than guess", () => {
    expect(missingCard('transit', 'SEQ-1')).toMatchObject({ path: '/timeline/transit/SEQ-1', title: 'A post on the Roadbeat timeline' })
  })

  it('build a preview page with escaped tags, the card image and the canonical address', () => {
    const c = { ...missingCard('road', '1'), title: 'A <b> & "c"' }
    const page = cardSharePage('https://www.roadbeat.app', c, 'https://www.roadbeat.app/api/share-image?source=road&id=1')
    expect(page).toContain('<link rel="canonical" href="https://www.roadbeat.app/timeline/road/1">')
    expect(page).toContain('content="https://www.roadbeat.app/api/share-image?source=road&#38;id=1"')
    expect(page).not.toContain('<b>')
    expect(cardDescription(c).length).toBeLessThanOrEqual(200)
    expect(cardPath('news', 'a b')).toBe('/timeline/news/a%20b')
  })

  it('never carry a fuel price: there is no fuel card', async () => {
    const mod = await import('./shareCard')
    expect(Object.keys(mod).some((k) => /fuel/i.test(k))).toBe(false)
  })
})
