// Cloudflare Pages Function: proxies /qfd-bushfires to the Queensland Fire
// Department's current bushfire incidents feed (data.qld.gov.au, CC BY 4.0),
// which sends no CORS headers, and caches it at the edge for a minute.
import { proxy, type ProxyContext } from './_lib/proxy'

export const onRequestGet = (context: ProxyContext) =>
  proxy(context, {
    url: 'https://publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com/content/Feeds/BushfireCurrentIncidents/bushfireAlert.json',
    contentType: 'application/json',
    maxAge: 60,
  })
