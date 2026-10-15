// Vercel Routing Middleware: Markdown for AI agents, matching
// functions/_middleware.ts on Cloudflare. A page request that sends
// `Accept: text/markdown` gets the page's Markdown version from site/plugin.ts.

export const config = { matcher: ['/', '/about/:path*', '/privacy/:path*', '/contact/:path*'] }

/** "/" → "/index.md", "/about/" → "/about.md". Mirrors markdownPathFor in site/plugin.ts. */
function markdownPathFor(path: string) {
  const clean = path.replace(/\/+$/, '') || '/'
  return clean === '/' ? '/index.md' : `${clean}.md`
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  if (!(request.headers.get('accept') ?? '').includes('text/markdown')) return undefined
  const url = new URL(request.url)
  const page = await fetch(new URL(markdownPathFor(url.pathname), url))
  if (!page.ok) return undefined
  return new Response(page.body, {
    headers: { 'content-type': 'text/markdown; charset=utf-8', vary: 'Accept', 'cache-control': 'public, max-age=300' },
  })
}
