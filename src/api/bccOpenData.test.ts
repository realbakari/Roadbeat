import { afterEach, describe, expect, it, vi } from 'vitest'
import { BCC_DATASETS, bccExport, bccFetch } from './bccOpenData'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('bccOpenData', () => {
  it('reads a dataset export, with query parameters only when given', async () => {
    const fetch = vi.fn(async () => new Response('[{"a":1}]'))
    vi.stubGlobal('fetch', fetch)
    expect(await bccExport('public-toilets-in-brisbane')).toEqual([{ a: 1 }])
    await bccExport('brisbane-city-council-events', undefined, { order_by: 'start_datetime' })
    expect(fetch.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      `${BCC_DATASETS}/public-toilets-in-brisbane/exports/json`,
      `${BCC_DATASETS}/brisbane-city-council-events/exports/json?order_by=start_datetime`,
    ])
  })
  it("keeps each layer's wording when the council's API fails", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
    await expect(bccFetch('x')).rejects.toThrow('Brisbane City Council responded with 503')
    await expect(bccFetch('x', {}, 'Gauge list')).rejects.toThrow('Gauge list responded with 503')
  })
  it('rejects an export that is not a list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"x"}')))
    await expect(bccExport('x')).rejects.toThrow()
  })
})
