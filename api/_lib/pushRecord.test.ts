import { describe, expect, it } from 'vitest'
import { isPushEndpoint } from './pushRecord'

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
