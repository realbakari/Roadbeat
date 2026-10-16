import { describe, expect, it } from 'vitest'
import { TRANSIT_REGIONS } from '../api/transitTypes'
import { liveRegions, PROBED_REGIONS, realtimeState, REGION_NAMES } from './transitRegions'

describe('transit regions', () => {
  it('names every region', () => {
    for (const r of TRANSIT_REGIONS) expect(REGION_NAMES[r], r).toBeTruthy()
  })

  it('probes every regional feed with a real-time endpoint, but not SEQ, Cairns or the Magnetic Island ferry', () => {
    expect(PROBED_REGIONS).toContain('NSI')
    expect(PROBED_REGIONS).toContain('TSV')
    expect(PROBED_REGIONS).not.toContain('SEQ')
    expect(PROBED_REGIONS).not.toContain('CNS')
    expect(PROBED_REGIONS).not.toContain('MIF')
  })
})

describe('liveRegions', () => {
  it('reads SEQ and Cairns always, other regions only while their feed lists trips', () => {
    expect(liveRegions({})).toEqual(['SEQ', 'CNS'])
    expect(liveRegions({ NSI: 4, TSV: 0 })).toEqual(['SEQ', 'CNS', 'NSI'])
  })
})

describe('realtimeState', () => {
  it('is live for SEQ and Cairns', () => {
    expect(realtimeState('SEQ', {})).toBe('live')
    expect(realtimeState('CNS', {})).toBe('live')
  })

  it('is checking until a regional feed has been read, then follows what it listed', () => {
    expect(realtimeState('NSI', {})).toBe('checking')
    expect(realtimeState('NSI', { NSI: 3 })).toBe('live')
    expect(realtimeState('TSV', { TSV: 0 })).toBe('timetable')
  })

  it('is timetable only where TransLink publishes no real-time feed', () => {
    expect(realtimeState('MIF', { MIF: 5 })).toBe('timetable')
  })
})
