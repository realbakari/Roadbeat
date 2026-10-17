import { afterEach, describe, expect, it, vi } from 'vitest'
import TIMES from '../test/jmaTimes.json'
import { fetchJmaFrames, jmaTiles, parseJmaTimes, stampToIso } from './jmaHimawari'

// The last four entries of targetTimes_fd.json as JMA published it on 17 October 2026 (it lists 213, oldest first).

afterEach(() => vi.unstubAllGlobals())

describe('parseJmaTimes', () => {
  it('reads each image time from its validtime, oldest first', () => {
    const frames = parseJmaTimes([...TIMES].reverse())
    expect(frames.map((f) => f.time)).toEqual(['2026-10-17T13:20:00Z', '2026-10-17T13:30:00Z', '2026-10-17T13:40:00Z', '2026-10-17T13:50:00Z'])
    expect(frames.at(-1)).toEqual({ basetime: '20261017135000', validtime: '20261017135000', time: '2026-10-17T13:50:00Z' })
  })

  it('rejects a list in another shape', () => {
    expect(() => parseJmaTimes(['20261017135000'])).toThrow()
    expect(() => parseJmaTimes([{ basetime: '2026-10-17', validtime: '2026-10-17' }])).toThrow()
  })
})

describe('stampToIso', () => {
  it('turns a JMA folder name into an ISO time', () => {
    expect(stampToIso('20261017135000')).toBe('2026-10-17T13:50:00Z')
  })
})

describe('jmaTiles', () => {
  it("builds JMA's tile address, column before row", () => {
    const frame = parseJmaTimes(TIMES).at(-1)!
    expect(jmaTiles('infrared', frame)).toBe('https://www.jma.go.jp/bosai/himawari/data/satimg/20261017135000/fd/20261017135000/B13/TBB/{z}/{x}/{y}.jpg')
    expect(jmaTiles('truecolour', frame)).toBe('https://www.jma.go.jp/bosai/himawari/data/satimg/20261017135000/fd/20261017135000/REP/ETC/{z}/{x}/{y}.jpg')
  })
})

describe('fetchJmaFrames', () => {
  it('reads the list and reports an error answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(TIMES)))
    expect(await fetchJmaFrames()).toHaveLength(4)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    await expect(fetchJmaFrames()).rejects.toThrow('500')
  })
})
