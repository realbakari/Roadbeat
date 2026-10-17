import { describe, expect, it } from 'vitest'
import { roadEvent } from '../test/fixtures'
import { eventSharePage, shareUrl } from './sharePage'

const ORIGIN = 'https://www.roadbeat.app'

describe('shareUrl', () => {
  it('gives road events a share page', () => {
    expect(shareUrl(ORIGIN, '#event/123')).toBe(`${ORIGIN}/api/share?event=123`)
  })

  it('leaves other views to be shared as they are', () => {
    expect(shareUrl(ORIGIN, '#place/locality/Albion')).toBeNull()
    expect(shareUrl(ORIGIN, '#event/abc')).toBeNull()
  })
})

describe('eventSharePage', () => {
  const crash = roadEvent(123, 'Bruce Highway', 'Burpengary')
  crash.properties.description = 'Crash involving two vehicles. <Expect delays> & use caution.'

  it("puts the event's official road, type and place in the preview tags", () => {
    const html = eventSharePage(ORIGIN, 123, crash)
    expect(html).toContain('<meta property="og:title" content="Bruce Highway: Crash · Roadbeat">')
    expect(html).toContain('Burpengary · Metropolitan. Crash involving two vehicles.')
  })

  it('escapes the feed text', () => {
    const html = eventSharePage(ORIGIN, 123, crash)
    expect(html).toContain('&#60;Expect delays&#62; &#38; use caution.')
    expect(html).not.toContain('<Expect')
  })

  it('sends people on to the event in the app', () => {
    expect(eventSharePage(ORIGIN, 123, crash)).toContain(`<meta http-equiv="refresh" content="0; url=${ORIGIN}/#event/123">`)
  })

  it('says so when the event is no longer listed', () => {
    expect(eventSharePage(ORIGIN, 9, null)).toContain('no longer listed by QLDTraffic')
  })
})
