import { describe, expect, it } from 'vitest'
import { decodePolyline } from './polyline'

describe('decodePolyline', () => {
  it('decodes Google’s documented example into [lng, lat] points', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ])
  })

  it('gives nothing for an empty string, and stops at a number cut short', () => {
    expect(decodePolyline('')).toEqual([])
    expect(decodePolyline('_p~iF~ps|U_ulL')).toEqual([[-120.2, 38.5]])
  })
})
