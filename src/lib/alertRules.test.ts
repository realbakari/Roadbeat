import { describe, expect, it } from 'vitest'
import type { FireWarning } from '../api/bushfires'
import { DEFAULT_SETTINGS, fireMatches, newsMatches, type AlertSettings } from './alertRules'
import { groupStories } from './newsStories'
import { gazetteerPlace, newsItem } from '../test/fixtures'

const fire = (over: Partial<FireWarning> = {}): FireWarning => ({
  id: 'WARN-1',
  level: 'Advice',
  levelText: 'Advice',
  title: 'STAY INFORMED - Upper Coomera',
  area: 'Upper Coomera, Wongawallan and Eagle Heights',
  location: null,
  status: null,
  kind: 'FIRE VEGETATION',
  callToAction: 'Stay Informed',
  header: null,
  impacts: null,
  shouldDo: null,
  leaveSafely: null,
  further: null,
  text: null,
  position: [153.27, -27.9],
  areaShape: null,
  issued: null,
  published: null,
  expires: null,
  ...over,
})
const settings = (over: Partial<AlertSettings> = {}): AlertSettings => ({ ...DEFAULT_SETTINGS, ...over })

describe('fireMatches', () => {
  it('alerts on warnings anywhere when no area is set', () => {
    expect(fireMatches(fire(), settings())).toBe(true)
  })
  it('never alerts on incidents without a warning', () => {
    expect(fireMatches(fire({ level: 'Information' }), settings())).toBe(false)
  })
  it('respects the bushfire switch', () => {
    expect(fireMatches(fire(), settings({ kinds: { ...DEFAULT_SETTINGS.kinds, bushfire: false } }))).toBe(false)
  })
  it('matches by distance from the fire', () => {
    expect(fireMatches(fire(), settings({ nearMe: { at: [153.3, -27.95], km: 10 } }))).toBe(true)
    expect(fireMatches(fire(), settings({ nearMe: { at: [153.02, -27.47], km: 10 } }))).toBe(false)
  })
  it('matches listed places against the warning area', () => {
    expect(fireMatches(fire(), settings({ roads: ['eagle heights'] }))).toBe(true)
    expect(fireMatches(fire(), settings({ roads: ['Toowong'] }))).toBe(false)
  })
  it('does not guess from TMR districts, which QFD does not use', () => {
    expect(fireMatches(fire(), settings({ districts: ['South Coast'] }))).toBe(false)
  })
})

describe('newsMatches', () => {
  const [story] = groupStories([
    newsItem({
      source: 'qps',
      publisher: 'Queensland Police',
      kind: 'official',
      title: 'Serious traffic crash, Mount Byron',
      summary: 'Emergency services were called to Mount Byron Road.',
      places: [gazetteerPlace('Mount Byron', 'Somerset Regional', [152.65, -27.13])],
    }),
  ])
  const on = { ...DEFAULT_SETTINGS.kinds, newsOfficial: true }

  it('is off until the user turns the kind on, and official and news are separate choices', () => {
    expect(newsMatches(story, settings())).toBe(false)
    expect(newsMatches(story, settings({ kinds: { ...DEFAULT_SETTINGS.kinds, news: true } }))).toBe(false)
    expect(newsMatches(story, settings({ kinds: on }))).toBe(true)
  })

  it('matches distance from a named place, or listed roads and places in the text', () => {
    expect(newsMatches(story, settings({ kinds: on, nearMe: { at: [152.7, -27.1], km: 10 } }))).toBe(true)
    expect(newsMatches(story, settings({ kinds: on, nearMe: { at: [153.02, -27.47], km: 10 } }))).toBe(false)
    expect(newsMatches(story, settings({ kinds: on, roads: ['mount byron road'] }))).toBe(true)
  })

  it('never matches a districts-only filter', () => {
    expect(newsMatches(story, settings({ kinds: on, districts: ['Metropolitan'] }))).toBe(false)
  })
})
