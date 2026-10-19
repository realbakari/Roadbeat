import { describe, expect, it } from 'vitest'
import { isPushEndpoint, KEEP_UNSEEN_MS, PushRecord, receivedRecord, seenState, Subscription } from './pushRecord'

describe('isPushEndpoint', () => {
  it("accepts the browsers' push services", () => {
    for (const url of [
      'https://fcm.googleapis.com/fcm/send/abc:123',
      'https://updates.push.services.mozilla.com/wpush/v2/gAAA',
      'https://web.push.apple.com/QGx1',
      'https://wns2-par02p.notify.windows.com/w/?token=x',
    ])
      expect(isPushEndpoint(url), url).toBe(true)
  })

  it('refuses any other address, plain HTTP, other ports and look-alike hosts', () => {
    for (const url of [
      'https://example.com/push',
      'http://fcm.googleapis.com/fcm/send/x',
      'https://fcm.googleapis.com:8443/x',
      'https://fcm.googleapis.com.evil.example/x',
      'https://evilpush.apple.com.example/x',
      'https://169.254.169.254/latest',
      'not a url',
    ])
      expect(isPushEndpoint(url), url).toBe(false)
  })
})

describe('Subscription', () => {
  const endpoint = 'https://fcm.googleapis.com/fcm/send/abc:123'
  const p256dh = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString('base64url')
  const auth = Buffer.alloc(16, 9).toString('base64url')

  it('takes keys of the sizes browsers make', () => {
    expect(Subscription.safeParse({ endpoint, keys: { p256dh, auth } }).success).toBe(true)
  })

  it("refuses keys web-push couldn't encrypt to", () => {
    for (const keys of [
      { p256dh: 'x', auth },
      { p256dh, auth: 'x' },
      { p256dh: `${p256dh}AA`, auth },
      { p256dh, auth: 'not base64url!!!!!!!!!' },
    ])
      expect(Subscription.safeParse({ endpoint, keys }).success, JSON.stringify(keys)).toBe(false)
  })
})

describe('last seen', () => {
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc:123',
    keys: { p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString('base64url'), auth: Buffer.alloc(16, 9).toString('base64url') },
  }
  const commute = { roads: ['Bruce Highway'], region: 'SEQ' as const, stopId: null, route: null, minutes: 450, days: [1, 2, 3, 4, 5] }
  const now = Date.parse('2026-10-21T00:00:00Z')

  it('reads a record stored before last-seen times, and stamps it rather than deleting it', () => {
    const r = PushRecord.parse({ subscription, commute, sent: ['a'] })
    expect(r.seen).toBeUndefined()
    expect(seenState(r, now)).toBe('unstamped')
  })

  it('keeps a record for 60 days after it was last seen, then expires it', () => {
    const r = PushRecord.parse({ subscription, commute, sent: [], seen: now })
    expect(seenState(r, now + KEEP_UNSEEN_MS)).toBe('current')
    expect(seenState(r, now + KEEP_UNSEEN_MS + 1)).toBe('expired')
  })

  it('keeps the alerts already sent when the app re-sends the same commute', () => {
    const previous = PushRecord.parse({ subscription, commute, sent: ['a', 'b'], seen: now - 86_400_000 })
    expect(receivedRecord(previous, PushRecord.parse({ subscription, commute }), now)).toEqual({ subscription, commute, sent: ['a', 'b'], seen: now })
  })

  it('starts afresh for a changed commute or a new subscription', () => {
    const previous = PushRecord.parse({ subscription, commute, sent: ['a'], seen: now - 86_400_000 })
    expect(receivedRecord(previous, { subscription, commute: { ...commute, minutes: 480 } }, now).sent).toEqual([])
    expect(receivedRecord(null, { subscription, commute }, now)).toEqual({ subscription, commute, sent: [], seen: now })
  })
})
