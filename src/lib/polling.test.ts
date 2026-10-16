import { describe, expect, it } from 'vitest'
import { dueOnReturn, shouldPoll, systemAlertsOn } from './polling'

describe('shouldPoll', () => {
  it('polls every feed while the tab is in view', () => {
    expect(shouldPoll('visible', false, false)).toBe(true)
  })

  it('keeps polling feeds that raise alerts in a hidden tab only while system notifications are on', () => {
    expect(shouldPoll('hidden', true, true)).toBe(true)
    expect(shouldPoll('hidden', true, false)).toBe(false)
    expect(shouldPoll('hidden', false, true)).toBe(false)
  })
})

describe('dueOnReturn', () => {
  it('reads again on return only once a poll has been missed', () => {
    expect(dueOnReturn(0, 60_000, 60_000)).toBe(true)
    expect(dueOnReturn(0, 10_000, 60_000)).toBe(false)
  })
})

describe('systemAlertsOn', () => {
  it('needs both the setting and the browser permission', () => {
    expect(systemAlertsOn({ browser: true }, 'granted')).toBe(true)
    expect(systemAlertsOn({ browser: true }, 'default')).toBe(false)
    expect(systemAlertsOn({ browser: false }, 'granted')).toBe(false)
  })
})
