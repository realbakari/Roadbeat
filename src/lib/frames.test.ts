import { describe, expect, it } from 'vitest'
import { domainFrames, mergeFrames, recentFrames, stepFrame } from './frames'

// GIBS DescribeDomains for Himawari_AHI_Band13_Clean_Infrared, 17 October 2026, word for word.
const DOMAINS =
  "<Domains xmlns:ows='http://www.opengis.net/ows/1.1'><SpaceDomain><BoundingBox miny='-20037508.342789' crs='urn:ogc:def:crs:EPSG::3857' minx='-20037508.342789' maxy='20037508.342789' maxx='20037508.342789'/></SpaceDomain><DimensionDomain><ows:Identifier>time</ows:Identifier><Domain>2026-10-16/2026-10-16T02:30:00Z/PT10M,2026-10-16T02:50:00Z/2026-10-16T14:30:00Z/PT10M,2026-10-16T14:50:00Z/2026-10-17T02:30:00Z/PT10M,2026-10-17T02:50:00Z/2026-10-17T13:10:00Z/PT10M</Domain><Size>4</Size></DimensionDomain></Domains>"

describe('domainFrames', () => {
  const frames = domainFrames(DOMAINS)
  it('lists every published time at its step, oldest first', () => {
    expect(frames[0]).toBe('2026-10-16T00:00:00Z')
    expect(frames.at(-1)).toBe('2026-10-17T13:10:00Z')
    expect(frames).toContain('2026-10-17T13:00:00Z')
  })
  it('adds nothing in the breaks between ranges', () => {
    expect(frames).toContain('2026-10-17T02:30:00Z')
    expect(frames).not.toContain('2026-10-17T02:40:00Z')
    expect(frames).not.toContain('2026-10-16T14:40:00Z')
    expect(frames).toContain('2026-10-17T02:50:00Z')
  })
  it('gives none for an empty or foreign document', () => {
    expect(domainFrames("<Domains><DimensionDomain><Domain></Domain></DimensionDomain></Domains>")).toEqual([])
    expect(domainFrames('<html>error</html>')).toEqual([])
  })
})

describe('mergeFrames and recentFrames', () => {
  it('joins two reads and keeps the last hours before the newest', () => {
    const all = mergeFrames(['2026-10-17T13:00:00Z', '2026-10-17T13:10:00Z'], ['2026-10-17T13:10:00Z', '2026-10-17T13:30:00Z', '2026-10-17T10:20:00Z'])
    expect(all).toEqual(['2026-10-17T10:20:00Z', '2026-10-17T13:00:00Z', '2026-10-17T13:10:00Z', '2026-10-17T13:30:00Z'])
    expect(recentFrames(all, 3)).toEqual(['2026-10-17T13:00:00Z', '2026-10-17T13:10:00Z', '2026-10-17T13:30:00Z'])
    expect(recentFrames([], 3)).toEqual([])
  })
})

describe('stepFrame', () => {
  const f = ['a', 'b', 'c']
  it('steps from the newest when none is chosen, and wraps round', () => {
    expect(stepFrame(f, null, -1)).toBe('b')
    expect(stepFrame(f, 'c', 1)).toBe('a')
    expect(stepFrame(f, 'a', -1)).toBe('c')
    expect(stepFrame(f, 'gone', 0)).toBe('c')
    expect(stepFrame([], null, 1)).toBeNull()
  })
})
