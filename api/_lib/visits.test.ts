import { describe, expect, it } from 'vitest'
import { brisbaneDay, clientIp, dayKey, recentWindowKeys, visitorId, WINDOW_MS, windowKey } from './visits'

describe('visitor counting', () => {
  it('rolls the day over at Brisbane midnight', () => {
    // 2026-10-16T14:30Z is 00:30 on the 17th in Brisbane (UTC+10).
    expect(brisbaneDay(Date.parse('2026-10-16T14:30:00Z'))).toBe('2026-10-17')
    expect(brisbaneDay(Date.parse('2026-10-16T13:30:00Z'))).toBe('2026-10-16')
  })

  it('gives the same browser one id a day and a different one the next day', () => {
    const a = visitorId('203.0.113.9', 'Mozilla/5.0', '2026-10-16', 'secret')
    expect(visitorId('203.0.113.9', 'Mozilla/5.0', '2026-10-16', 'secret')).toBe(a)
    expect(visitorId('203.0.113.9', 'Mozilla/5.0', '2026-10-17', 'secret')).not.toBe(a)
    expect(visitorId('203.0.113.10', 'Mozilla/5.0', '2026-10-16', 'secret')).not.toBe(a)
    expect(visitorId('203.0.113.9', 'Mozilla/5.0', '2026-10-16', 'other')).not.toBe(a)
  })

  it('never contains the address it was made from', () => {
    const id = visitorId('203.0.113.9', 'Mozilla/5.0', '2026-10-16', 'secret')
    expect(id).not.toContain('203')
    expect(id).toHaveLength(22)
  })

  it('names keys by day and by 5-minute window, newest first', () => {
    const t = 1_792_130_000_000
    expect(dayKey('2026-10-16')).toBe('visits:day:2026-10-16')
    expect(windowKey(t)).toBe(`visits:win:${Math.floor(t / WINDOW_MS)}`)
    expect(recentWindowKeys(t)).toEqual([windowKey(t), windowKey(t - WINDOW_MS)])
  })

  it('reads the first forwarded address, else the direct one', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9')
    expect(clientIp(new Headers({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9')
    expect(clientIp(new Headers())).toBe('')
  })
})
