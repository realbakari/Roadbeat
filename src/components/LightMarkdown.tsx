import type { ReactNode } from 'react'

/**
 * Renders the small Markdown subset in Queensland Rail's station text: paragraphs,
 * "* " bullet lists, **bold** and [links](url). Builds React elements, so nothing
 * from the feed is inserted as HTML. Relative links resolve against `base`.
 */
export function LightMarkdown({ text, base }: { text: string; base: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\s*\n/)
  return (
    <div className="grid gap-2 text-sm">
      {blocks.map((block, i) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
        if (lines.length && lines.every((l) => /^[*-]\s/.test(l))) {
          return (
            <ul key={i} className="grid list-disc gap-0.5 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^[*-]\s+/, ''), base)}</li>
              ))}
            </ul>
          )
        }
        return <p key={i}>{inline(lines.join(' '), base)}</p>
      })}
    </div>
  )
}

function inline(s: string, base: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*\[([^\]]+)\]\(([^)]+)\)\*\*|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g
  let last = 0
  for (const m of s.matchAll(re)) {
    if (m.index > last) out.push(s.slice(last, m.index).replace(/\*\*/g, ''))
    const label = m[1] ?? m[3]
    const href = m[2] ?? m[4]
    if (label && href) {
      let url: URL | null = null
      try {
        url = new URL(href, base)
      } catch {
        url = null
      }
      out.push(
        url && /^https?:$/.test(url.protocol) ? (
          <a key={m.index} href={url.href} target="_blank" rel="noreferrer" className="text-kumo-link hover:underline">
            {label.replace(/\*\*/g, '')}
          </a>
        ) : (
          label
        ),
      )
    } else {
      out.push(
        <strong key={m.index} className="font-medium">
          {m[5]}
        </strong>,
      )
    }
    last = m.index + m[0].length
  }
  if (last < s.length) out.push(s.slice(last).replace(/\*\*/g, ''))
  return out
}
