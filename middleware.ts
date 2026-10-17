// Vercel Routing Middleware: Markdown for AI agents, matching
// functions/_middleware.ts on Cloudflare. A page request that sends
// `Accept: text/markdown` gets the page's Markdown version from site/plugin.ts,
// and an unknown page gets the Markdown 404 with status 404.

// Pages only: skip files (paths with a dot), the API, the MCP server and the six proxies.
export const config = { matcher: ['/((?!api/|mcp|translink-rt|qfd-bushfires|qfd-firebans|qld-warnings|qld-gauges|air-quality|.*\\..*).*)'], runtime: 'nodejs' }

const MARKDOWN = { 'content-type': 'text/markdown; charset=utf-8', vary: 'Accept', 'cache-control': 'public, max-age=300' }

/** "/" → "/index.md", "/about/" → "/about.md". Mirrors markdownPathFor in site/markdown.ts. */
function markdownPathFor(path: string) {
  const clean = path.replace(/\/+$/, '') || '/'
  return clean === '/' ? '/index.md' : `${clean}.md`
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  if (request.method !== 'GET' || !(request.headers.get('accept') ?? '').includes('text/markdown')) return undefined
  const url = new URL(request.url)
  const page = await fetch(new URL(markdownPathFor(url.pathname), url))
  if (page.ok) return new Response(page.body, { headers: MARKDOWN })
  const missing = await fetch(new URL('/404.md', url))
  return new Response(missing.body, { status: 404, headers: MARKDOWN })
}
