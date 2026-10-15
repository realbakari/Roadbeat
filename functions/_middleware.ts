// Cloudflare Pages middleware: Markdown for AI agents. A request that sends
// `Accept: text/markdown` for a page gets the page's Markdown version (built by
// site/plugin.ts), and an unknown page gets the Markdown 404 with status 404.
// HTML responses say they vary by Accept, so caches keep the two apart.

interface Context {
  request: Request
  next: () => Promise<Response>
  env: { ASSETS: { fetch: (input: Request | URL | string) => Promise<Response> } }
}

const MARKDOWN = { 'content-type': 'text/markdown; charset=utf-8', vary: 'Accept', 'cache-control': 'public, max-age=300' }

/** "/" → "/index.md", "/about/" → "/about.md". Mirrors markdownPathFor in site/plugin.ts. */
function markdownPathFor(path: string) {
  const clean = path.replace(/\/+$/, '') || '/'
  return clean === '/' ? '/index.md' : `${clean}.md`
}

export async function onRequest({ request, next, env }: Context): Promise<Response> {
  const url = new URL(request.url)
  const isPage = request.method === 'GET' && !url.pathname.includes('.') && !url.pathname.startsWith('/translink-rt') && url.pathname !== '/qfd-bushfires'

  if (url.pathname.endsWith('.md')) {
    const res = await env.ASSETS.fetch(url)
    return res.ok ? new Response(res.body, { headers: MARKDOWN }) : res
  }

  if (isPage && (request.headers.get('accept') ?? '').includes('text/markdown')) {
    const page = await env.ASSETS.fetch(new URL(markdownPathFor(url.pathname), url))
    if (page.ok) return new Response(page.body, { headers: MARKDOWN })
    const missing = await env.ASSETS.fetch(new URL('/404.md', url))
    return new Response(missing.body, { status: 404, headers: MARKDOWN })
  }

  const res = await next()
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res
  const out = new Response(res.body, res)
  out.headers.append('vary', 'Accept')
  return out
}
