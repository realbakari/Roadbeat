import { describe, expect, it } from 'vitest'
import { addressBlock, brisbaneDay, clientIp, dayKey, hasRoom, rateKey, recentWindowKeys, seenKey, visitorId, WINDOW_MS, windowKey } from './visits'

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

  it('counts a daily limit by address alone, so a new browser name starts no new count', () => {
    const key = rateKey('feedback', '203.0.113.9', '2026-10-16', 'secret')
    expect(key).toMatch(/^feedback:rate:[\w-]{22}$/)
    expect(key).not.toContain('203')
    expect(rateKey('push', '203.0.113.9', '2026-10-16', 'secret')).not.toBe(key)
    expect(rateKey('feedback', '203.0.113.10', '2026-10-16', 'secret')).not.toBe(key)
    expect(rateKey('feedback', '203.0.113.9', '2026-10-17', 'secret')).not.toBe(key)
  })

  it('counts an IPv6 address by its /64 network, and an IPv4 address alone', () => {
    expect(addressBlock('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64')
    expect(addressBlock('2001:0DB8:0001:0002:ffff:0:0:9')).toBe('2001:db8:1:2::/64')
    expect(addressBlock('2001:db8::1')).toBe('2001:db8:0:0::/64')
    expect(addressBlock('fe80::1%eth0')).toBe('fe80:0:0:0::/64')
    expect(addressBlock('::ffff:203.0.113.9')).toBe('203.0.113.9')
    expect(addressBlock('203.0.113.9')).toBe('203.0.113.9')
    expect(addressBlock('')).toBe('')
    expect(rateKey('push', '2001:db8:1:2::a', '2026-10-16', 's')).toBe(rateKey('push', '2001:db8:1:2:ffff::b', '2026-10-16', 's'))
  })

  it('reads the first forwarded address, else the direct one', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9')
    expect(clientIp(new Headers({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9')
    expect(clientIp(new Headers())).toBe('')
  })
})

describe('Redis command savings', () => {
  it('marks a browser once per 5-minute window', () => {
    const start = Math.floor(Date.parse('2026-10-20T00:00:00Z') / WINDOW_MS) * WINDOW_MS
    expect(seenKey(start, 'abc')).toBe(seenKey(start + WINDOW_MS - 1, 'abc'))
    expect(seenKey(start + WINDOW_MS, 'abc')).not.toBe(seenKey(start, 'abc'))
    expect(seenKey(start, 'abc')).not.toBe(seenKey(start, 'abd'))
  })

  it('has room until a daily count reaches its limit', () => {
    expect(hasRoom(null, 10)).toBe(true)
    expect(hasRoom('9', 10)).toBe(true)
    expect(hasRoom('10', 10)).toBe(false)
    expect(hasRoom(11, 10)).toBe(false)
  })
})
