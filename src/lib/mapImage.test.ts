import { describe, expect, it } from 'vitest'
import { imageFileName, imageFooter, imageSources, satelliteImageTime, wrapText } from './mapImage'

const now = Date.parse('2026-10-17T14:52:00Z') // 12:52 am Sunday in Queensland

describe('imageFileName', () => {
  it('names the file by the Queensland date and time', () => {
    expect(imageFileName(now)).toBe('roadbeat-2026-10-18-0052.png')
  })
})

describe('imageFooter', () => {
  it('stamps the save time in AEST, the sources and credits, and what is left out', () => {
    const f = imageFooter({ now, siteUrl: 'https://www.roadbeat.app', sources: ['Road events: QLDTraffic, read 12:51 am AEST'], credits: 'OpenFreeMap  © OpenMapTiles', radar: true, cameraThumbs: false })
    expect(f.title).toBe('Roadbeat · www.roadbeat.app')
    expect(f.saved).toMatch(/^Saved Sun, 18 Oct 2026, 12:52 am AEST\./)
    expect(f.credits).toBe('OpenFreeMap © OpenMapTiles')
    expect(f.missing).toEqual(['Rain radar is not in this image (its host does not allow it to be copied).'])
  })
})

describe('wrapText', () => {
  it('breaks on words to fit a width', () => {
    expect(wrapText('one two three four', 9, (s) => s.length)).toEqual(['one two', 'three', 'four'])
  })
})

describe('imageSources', () => {
  const live = { now, replayAt: null, eventsReadAt: null, firesReadAt: null, satellite: null }

  it('always names the road events, with their read time once known', () => {
    expect(imageSources(live)).toEqual(['Road events: QLDTraffic'])
    expect(imageSources({ ...live, eventsReadAt: now - 5 * 60_000 })).toEqual(['Road events: QLDTraffic, read 12:47 am AEST'])
  })

  it('says a replay is a replay, whatever was last read', () => {
    expect(imageSources({ ...live, replayAt: now - 60 * 60_000, eventsReadAt: now })[0]).toBe('Road events: QLDTraffic, replay of Sat 11:52 pm AEST')
  })

  it('adds bushfires and the satellite image when shown', () => {
    expect(imageSources({ ...live, firesReadAt: now, satellite: { label: 'Himawari-9 infrared', time: '12:40 am AEST' } }).slice(1)).toEqual([
      'Bushfires: Queensland Fire Department, read 12:52 am AEST',
      'Satellite: Himawari-9 infrared, image 12:40 am AEST',
    ])
  })
})

describe('satelliteImageTime', () => {
  it("gives a live frame's published time in AEST", () => {
    expect(satelliteImageTime({ frameTime: '2026-10-17T14:40:00Z', live: true, date: '2026-10-17', now })).toBe('12:40 am AEST')
  })

  it("gives a daily image's date, or says it isn't known", () => {
    expect(satelliteImageTime({ frameTime: null, live: false, date: '2026-10-17', now })).toBe('2026-10-17')
    expect(satelliteImageTime({ frameTime: 'not a time', live: true, date: null, now })).toBe('date not known')
  })
})
