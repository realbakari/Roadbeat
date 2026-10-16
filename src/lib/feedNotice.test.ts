import { describe, expect, it } from 'vitest'
import { feedNotice, gaugeNotice } from './feedNotice'

describe('feedNotice', () => {
  it('says nothing while the feed is fine', () => {
    expect(feedNotice('Bushfire warnings', true, null)).toBeNull()
  })

  it('says a feed that never loaded is unavailable, rather than empty', () => {
    expect(feedNotice('Bushfire warnings', false, 'The QFD feed responded with 502')).toBe('Bushfire warnings unavailable: The QFD feed responded with 502.')
  })

  it('says a list kept after a failed refresh is the last one read', () => {
    const at = Date.parse('2026-10-16T14:05:00+10:00')
    expect(feedNotice('Bushfire warnings', true, 'timeout', at)).toBe("Bushfire warnings couldn't be refreshed: timeout. Showing the list read at 2:05 pm.")
  })
})

describe('gaugeNotice', () => {
  it('names the publisher whose gauges are missing when the other still loads', () => {
    expect(gaugeNotice(true, [{ source: 'Queensland Government', error: '502' }], 0)).toBe('Queensland Government gauges unavailable: 502. Showing the others.')
  })

  it('treats both failing like any other feed', () => {
    expect(gaugeNotice(false, [{ source: 'all', error: '502' }], null)).toBe('Gauges unavailable: 502.')
    expect(gaugeNotice(true, [], 0)).toBeNull()
  })
})
