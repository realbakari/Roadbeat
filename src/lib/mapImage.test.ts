import { describe, expect, it } from 'vitest'
import { imageFileName, imageFooter, wrapText } from './mapImage'

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
