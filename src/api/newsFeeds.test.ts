import { describe, expect, it } from 'vitest'
import { bomWarningFiles, parseBomAmoc, parseQuakes, parseRss } from './newsFeeds'

// Cut down from the real feeds as published on 16 October 2026.
const SEVEN = `<rss><channel><title><![CDATA[7NEWS]]></title>
<item>
  <title><![CDATA[‘Ridiculous proposal’: Brisbane ferry bar plan slammed by unions]]></title>
  <description><![CDATA[Fridges, extra weight and drunk passengers are among the issues unions say council has yet to address.]]></description>
  <link>https://7news.com.au/news/ridiculous-proposal-c-23025335</link>
  <pubDate>Thu, 15 Oct 2026 09:00:16 GMT</pubDate>
  <media:content url="https://images.7news.com.au/x.png" medium="image"><caption><![CDATA[Not this]]></caption></media:content>
</item>
<item><title>No link</title></item>
</channel></rss>`

const QPS = `<rss><channel><title>Queensland Police News</title>
<item>
  <title>Serious traffic crash charges, Burpengary East</title>
  <link>https://mypolice.qld.gov.au/news/2026/10/16/serious-traffic-crash-charges-burpengary-east/</link>
  <pubDate>Thu, 15 Oct 2026 17:53:32 +0000</pubDate>
  <category><![CDATA[Moreton]]></category>
  <category><![CDATA[North Coast]]></category>
  <description><![CDATA[A man has been charged following a crash at Burpengary East last night, 15 October. It will be alleged [&#8230;]]]></description>
  <content:encoded><![CDATA[<p>The full release, which the monitor never reads.</p>]]></content:encoded>
</item>
</channel></rss>`

const BRISBANE_TIMES = `<rss><channel><item><category>Politics / Queensland</category><description>The LNP is adamant.</description><link>https://www.brisbanetimes.com.au/politics/queensland/lnp-20261016-p6.html?ref=rss&amp;utm_medium=rss</link><pubDate>Fri, 16 Oct 2026 08:43:16 +1000</pubDate><title>&#39;Adamant&#39;: Brisbane 2032</title></item></channel></rss>`

describe('parseRss', () => {
  it('reads title, link, date, description and categories, unwrapping CDATA and entities', () => {
    expect(parseRss(SEVEN)).toEqual([
      {
        title: '‘Ridiculous proposal’: Brisbane ferry bar plan slammed by unions',
        link: 'https://7news.com.au/news/ridiculous-proposal-c-23025335',
        published: Date.parse('2026-10-15T09:00:16Z'),
        description: 'Fridges, extra weight and drunk passengers are among the issues unions say council has yet to address.',
        categories: [],
      },
    ])
    const [qps] = parseRss(QPS)
    expect(qps.categories).toEqual(['Moreton', 'North Coast'])
    expect(qps.description).not.toContain('full release')
    const [bt] = parseRss(BRISBANE_TIMES)
    expect(bt.title).toBe("'Adamant': Brisbane 2032")
    expect(bt.link).toBe('https://www.brisbanetimes.com.au/politics/queensland/lnp-20261016-p6.html?ref=rss&utm_medium=rss')
    expect(bt.published).toBe(Date.parse('2026-10-15T22:43:16Z'))
  })
})

const amoc = (o: { type?: string; status?: string; phase?: string; expiry?: string } = {}) => `<?xml version="1.0"?>
<amoc version="1.7">
  <identifier>IDQ20002</identifier>
  <issue-time-utc>2026-10-15T19:24:14Z</issue-time-utc>
  <expiry-time>${o.expiry ?? '2026-10-16T07:00:00Z'}</expiry-time>
  <status>${o.status ?? 'O'}</status>
  <product-type>${o.type ?? 'W'}</product-type>
  <phase>${o.phase ?? 'NEW'}</phase>
  <hazard index="1"><headline>Road Weather Alert for Slippery Roads for Brisbane</headline></hazard>
</amoc>`

describe('parseBomAmoc', () => {
  const now = Date.parse('2026-10-15T22:00:00Z')

  it('reads a current warning: id, headline, issue and expiry times', () => {
    expect(parseBomAmoc(amoc(), now)).toEqual({
      id: 'IDQ20002',
      headline: 'Road Weather Alert for Slippery Roads for Brisbane',
      issued: Date.parse('2026-10-15T19:24:14Z'),
      expires: Date.parse('2026-10-16T07:00:00Z'),
    })
  })

  it('skips forecasts, tests, cancellations and expired warnings', () => {
    expect(parseBomAmoc(amoc({ type: 'F' }), now)).toBeNull()
    expect(parseBomAmoc(amoc({ status: 'T' }), now)).toBeNull()
    expect(parseBomAmoc(amoc({ phase: 'CAN' }), now)).toBeNull()
    expect(parseBomAmoc(amoc({ expiry: '2026-10-15T21:00:00Z' }), now)).toBeNull()
  })

  it('picks Queensland warning products from a directory listing', () => {
    expect(bomWarningFiles(['IDQ10090.amoc.xml', 'IDQ20002.amoc.xml', 'IDQ20002.xml', 'IDN21033.amoc.xml', 'IDQ21035.amoc.xml'])).toEqual([
      'IDQ20002.amoc.xml',
      'IDQ21035.amoc.xml',
    ])
  })
})

describe('parseQuakes', () => {
  const feature = (description: string, extra: Record<string, unknown> = {}) => ({
    properties: {
      event_id: 'ga2026tgxxsz',
      origin_time: '2026-09-29T04:59:52.634Z',
      preferred_magnitude: 2.27810320374413,
      preferred_magnitude_type: 'MLa075',
      description,
      latitude: -23.8,
      longitude: 151.0,
      ...extra,
    },
  })

  it("keeps Queensland earthquakes with GA's magnitude, place and epicentre", () => {
    expect(parseQuakes({ features: [feature('Near Mount Larcom, QLD'), feature('23 km SW of Orange, NSW')] })).toEqual([
      { id: 'ga2026tgxxsz', magnitude: '2.3', magnitudeType: 'MLa075', place: 'Near Mount Larcom, QLD', at: Date.parse('2026-09-29T04:59:52.634Z'), position: [151.0, -23.8] },
    ])
  })

  it('drops records with no event id or time, as GA publishes placeholders', () => {
    expect(parseQuakes({ features: [feature('Near Mount Larcom, QLD', { event_id: null }), feature('Off X, QLD', { origin_time: null })] })).toEqual([])
  })

  it('rejects a response that is not a feature collection', () => {
    expect(() => parseQuakes({ error: 'x' })).toThrow()
  })
})
