// Cloudflare Pages Function: proxies /air-quality to the Department of
// Environment, Tourism, Science and Innovation's live air quality feed
// (data.qld.gov.au, CC BY 4.0), which sends no CORS headers. The feed changes
// hourly, so the edge keeps it for 5 minutes.
import { proxy, type ProxyContext } from './_lib/proxy'

export const onRequestGet = (context: ProxyContext) =>
  proxy(context, {
    url: 'https://apps.des.qld.gov.au/air-quality/xml/feed.php?category=1&region=ALL',
    contentType: 'text/xml; charset=utf-8',
    maxAge: 300,
  })
