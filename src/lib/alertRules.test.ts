import { describe, expect, it } from 'vitest'
import type { FireWarning } from '../api/bushfires'
import { DEFAULT_SETTINGS, fireMatches, type AlertSettings } from './alertRules'

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
