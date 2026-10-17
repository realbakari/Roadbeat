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

  it("accepts the councils' own storage buckets, not any bucket on those clouds", () => {
    expect(isCameraImage('https://camera-custom-image.s3-ap-southeast-2.amazonaws.com/a.jpg')).toBe(true)
    expect(isCameraImage('https://d2w9pjl8ozl6el.cloudfront.net/a.jpg')).toBe(true)
    expect(isCameraImage('https://prospectsstorageaccount.blob.core.windows.net/c/a.jpg')).toBe(true)
    expect(isCameraImage('https://someone-else.s3.amazonaws.com/a.jpg')).toBe(false)
    expect(isCameraImage('https://abc123.cloudfront.net/a.jpg')).toBe(false)
    expect(isCameraImage('https://other.blob.core.windows.net/a.jpg')).toBe(false)
  })
})
