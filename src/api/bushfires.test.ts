import { describe, expect, it } from 'vitest'
import { parseBushfires } from './bushfires'

const feature = (properties: Record<string, unknown>, geometry: unknown = null) => ({ type: 'Feature', geometry, properties })

const feed = {
  type: 'FeatureCollection',
  features: [
    feature(
      { UniqueID: 'QF7-1', WarningLevel: 'Information', WarningTitle: 'Information - COEN', Location: 'Birthday Mountain Rd', CurrentStatus: 'Going', ItemDateTimeLocal_ISO: '2026-10-15T03:11:21+10:00' },
      { type: 'Point', coordinates: [143.2, -13.55] },
    ),
    feature(
      {
        UniqueID: 'WARN-1',
        WarningLevel: 'Advice',
        WarningTitle: 'STAY INFORMED - Irvinebank',
        WarningArea: 'Irvinebank and Watsonville',
        CallToAction: 'Stay Informed',
        Header: 'A fire is burning.\r\n\r\nStay informed.',
        Latitude: '-17.4',
        Longitude: '145.19',
        GroupedType: 'FIRE VEGETATION',
        ItemDateTimeLocal_ISO: '2026-10-15T09:20:52+10:00',
      },
      { type: 'Polygon', coordinates: [[[145, -17], [145.3, -17], [145.3, -17.6], [145, -17]]] },
    ),
    feature({ UniqueID: 'WARN-2', WarningLevel: 'Watch and Act', Latitude: '-27.6', Longitude: '153.1' }),
    feature({ UniqueID: 'NOWHERE', WarningLevel: 'Advice' }),
    'not a feature',
  ],
}

describe('parseBushfires', () => {
  const fires = parseBushfires(feed)

  it('orders warnings by level, highest first', () => {
    expect(fires.map((f) => [f.id, f.level])).toEqual([
      ['WARN-2', 'Watch and Act'],
      ['WARN-1', 'Advice'],
      ['QF7-1', 'Information'],
    ])
  })

  it('skips items with no location or that are not features', () => {
    expect(fires.find((f) => f.id === 'NOWHERE')).toBeUndefined()
    expect(fires).toHaveLength(3)
  })

  it('takes the position from the published coordinates, or the point geometry', () => {
    expect(fires.find((f) => f.id === 'WARN-1')?.position).toEqual([145.19, -17.4])
    expect(fires.find((f) => f.id === 'QF7-1')?.position).toEqual([143.2, -13.55])
  })

  it('keeps warning areas and the published wording', () => {
    const w = fires.find((f) => f.id === 'WARN-1')!
    expect(w.areaShape?.type).toBe('Polygon')
    expect(w.header).toBe('A fire is burning.\n\nStay informed.')
    expect(w.issued).toBe(Date.parse('2026-10-15T09:20:52+10:00'))
  })

  it('rejects a response that is not a feature collection', () => {
    expect(() => parseBushfires({ error: 'down' })).toThrow()
  })
})
