import { describe, expect, it } from 'vitest'
import type { FireWarning } from '../api/bushfires'
import { alertArea, DEFAULT_SETTINGS, fireMatches, matchesRules, newsMatches, parseSettings, warningMatches, type AlertSettings } from './alertRules'
import { groupStories } from './newsStories'
import { gazetteerPlace, newsItem, qldWarning, roadEvent } from '../test/fixtures'

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
// Alerts from anywhere, as most of these tests are about what matches, not where.
const settings = (over: Partial<AlertSettings> = {}): AlertSettings => ({ ...DEFAULT_SETTINGS, everywhere: true, ...over })

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

describe('parseSettings', () => {
  it('reads saved settings back unchanged', () => {
    const saved: AlertSettings = { ...DEFAULT_SETTINGS, browser: true, districts: ['Metropolitan'], nearMe: { at: [153, -27.5], km: 10 }, watchedEvents: [42], routes: ['T1'] }
    expect(parseSettings(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
  })

  it('falls back field by field instead of crashing on a bad value', () => {
    const s = parseSettings({ inApp: false, districts: 'Metropolitan', roads: ['Bruce Highway', 7], kinds: { crash: false, news: 'yes' }, nearMe: { at: [153], km: 5 }, watchedEvents: null })
    expect(s.inApp).toBe(false)
    expect(s.districts).toEqual([])
    expect(s.roads).toEqual(['Bruce Highway'])
    expect(s.kinds).toEqual({ ...DEFAULT_SETTINGS.kinds, crash: false })
    expect(s.nearMe).toBeNull()
    expect(s.watchedEvents).toEqual([])
  })

  it('gives the defaults for something that is not settings at all', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings([1, 2])).toEqual(DEFAULT_SETTINGS)
  })
})

describe('warningMatches', () => {
  const s = settings
  // A square around Condamine, its marker well away at one corner.
  const square: GeoJSON.MultiPolygon = { type: 'MultiPolygon', coordinates: [[[[150, -27], [151, -27], [151, -26], [150, -26], [150, -27]]]] }
  const w = { ...qldWarning('Q1', 'Watch and Act', 'Condamine', [150, -27]), areaShape: square }

  it('matches anywhere without an area filter, and never a level outside the warning system', () => {
    expect(warningMatches(w, s())).toBe(true)
    expect(warningMatches({ ...w, level: 'Other' }, s())).toBe(false)
  })

  it('matches a nearby point inside the published area, or the user’s listed places', () => {
    expect(warningMatches(w, s({ nearMe: { at: [150.9, -26.1], km: 5 } }))).toBe(true)
    expect(warningMatches(w, s({ nearMe: { at: [152, -26.1], km: 5 } }))).toBe(false)
    expect(warningMatches(w, s({ roads: ['condamine'] }))).toBe(true)
  })

  it('never matches a districts-only filter, as warnings aren’t filed under TMR districts', () => {
    expect(warningMatches(w, s({ districts: ['Darling Downs'] }))).toBe(false)
  })
})

describe('alertArea', () => {
  it('is unset on a first visit, and new items then alert only once the user chooses where', () => {
    const crash = roadEvent(1, 'Bruce Highway', 'Caboolture')
    expect(alertArea(DEFAULT_SETTINGS)).toBe('unset')
    expect(matchesRules(crash, DEFAULT_SETTINGS)).toBe(false)
    expect(warningMatches(qldWarning('Q1', 'Emergency Warning', 'Condamine'), DEFAULT_SETTINGS)).toBe(false)
    expect(fireMatches(fire(), DEFAULT_SETTINGS)).toBe(false)

    const anywhere = { ...DEFAULT_SETTINGS, everywhere: true }
    expect(alertArea(anywhere)).toBe('everywhere')
    expect(matchesRules(crash, anywhere)).toBe(true)

    const nearby = { ...DEFAULT_SETTINGS, nearMe: { at: [0, 0] as [number, number], km: 25 } }
    expect(alertArea(nearby)).toBe('places')
  })

  it('keeps statewide alerts for settings saved before the choice existed', () => {
    expect(parseSettings({ inApp: true }).everywhere).toBe(true)
    expect(parseSettings({ everywhere: false }).everywhere).toBe(false)
  })
})
