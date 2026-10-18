// Cloudflare Pages Function: proxies /qld-warnings to Queensland's Severe
// Weather, Flood and Cyclone warnings feed (disaster.qld.gov.au, CC BY 4.0),
// which sends no CORS headers, and caches it at the edge for a minute.
import { proxy, type ProxyContext } from './_lib/proxy'

export const onRequestGet = (context: ProxyContext) =>
  proxy(context, {
    url: 'https://publiccontent-qld-alerts.s3.ap-southeast-2.amazonaws.com/content/Feeds/StormFloodCycloneWarnings/StormWarnings.json',
    contentType: 'application/json',
    maxAge: 60,
  })
