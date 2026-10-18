// Cloudflare Pages Function: proxies /qfd-firebans to the Queensland Fire
// Department's fire ban feed, which sends no CORS headers, and caches it at the
// edge for a minute. (On Vercel, a rewrite in vercel.json does the same.)
import { proxy, type ProxyContext } from './_lib/proxy'

export const onRequestGet = (context: ProxyContext) =>
  proxy(context, {
    url: 'https://publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com/content/Feeds/QLDFireban/FIREBAN.xml',
    contentType: 'application/atom+xml; charset=utf-8',
    maxAge: 60,
  })
