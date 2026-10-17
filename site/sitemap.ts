// robots.txt and sitemap.xml.
import { SITE, type SiteSettings } from './settings.ts'

export function robots(s: SiteSettings) {
  return `# ${SITE.name}: every page may be crawled, by search engines and AI agents alike.
User-agent: *
Allow: /
Disallow: /translink-rt/
Disallow: /qfd-bushfires
Disallow: /qfd-firebans
Disallow: /qld-warnings
Disallow: /qld-gauges
Disallow: /air-quality
Disallow: /api/
Disallow: /mcp
${s.siteUrl ? `\nSitemap: ${s.siteUrl}/sitemap.xml\n` : ''}`
}

/** The sitemap protocol's limit on URLs per file. */
export const SITEMAP_LIMIT = 50_000

const XML = '<?xml version="1.0" encoding="UTF-8"?>\n'
const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'

/**
 * sitemap.xml listing every indexable page. Over `limit` URLs, sitemap.xml
 * becomes a sitemap index of sitemap-1.xml, sitemap-2.xml and so on.
 */
export function sitemapFiles(s: SiteSettings, paths: string[], limit = SITEMAP_LIMIT): Record<string, string> {
  const today = new Date().toISOString().slice(0, 10)
  const urlset = (list: string[]) => `${XML}<urlset ${NS}>\n${list.map((p) => `  <url><loc>${s.siteUrl}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`
  if (paths.length <= limit) return { '/sitemap.xml': urlset(paths) }
  const files: Record<string, string> = {}
  const parts: string[] = []
  for (let i = 0; i * limit < paths.length; i++) {
    files[`/sitemap-${i + 1}.xml`] = urlset(paths.slice(i * limit, (i + 1) * limit))
    parts.push(`  <sitemap><loc>${s.siteUrl}/sitemap-${i + 1}.xml</loc><lastmod>${today}</lastmod></sitemap>`)
  }
  files['/sitemap.xml'] = `${XML}<sitemapindex ${NS}>\n${parts.join('\n')}\n</sitemapindex>\n`
  return files
}
