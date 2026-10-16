import { describe, expect, it } from 'vitest'
import { isCameraImage } from './cameraHosts'

describe('isCameraImage', () => {
  it('accepts https images on QLDTraffic and council camera hosts only', () => {
    expect(isCameraImage('https://cameras.qldtraffic.qld.gov.au/Metropolitan/x.jpg')).toBe(true)
    expect(isCameraImage('https://portal.sightmaster.com.au/latest/3211')).toBe(true)
    expect(isCameraImage('http://cameras.qldtraffic.qld.gov.au/x.jpg')).toBe(false)
    expect(isCameraImage('https://example.com/x.jpg')).toBe(false)
    expect(isCameraImage('not a url')).toBe(false)
  })
})
