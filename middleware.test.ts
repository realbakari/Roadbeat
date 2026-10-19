import { afterEach, describe, expect, it, vi } from 'vitest'
import middleware from './middleware.ts'

const markdownRequest = (url: string) => new Request(url, { headers: { accept: 'text/markdown' } })

describe('Markdown middleware', () => {
  afterEach(() => vi.unstubAllGlobals())

  it("fetches a page's Markdown from this site", async () => {
    const fetch = vi.fn(async () => new Response('# About'))
    vi.stubGlobal('fetch', fetch)
    const res = await middleware(markdownRequest('https://roadbeat.test/about/'))
    expect(fetch).toHaveBeenCalledWith(new URL('https://roadbeat.test/about.md'))
    expect(await res?.text()).toBe('# About')
  })

  it('never fetches from another host named by a path that starts with two slashes', async () => {
    const fetch = vi.fn(async () => new Response('elsewhere'))
    vi.stubGlobal('fetch', fetch)
    for (const path of ['//1572395042/x', '//example/', '///example/x']) {
      expect(await middleware(markdownRequest(`https://roadbeat.test${path}`))).toBeUndefined()
    }
    expect(fetch).not.toHaveBeenCalled()
  })
})
