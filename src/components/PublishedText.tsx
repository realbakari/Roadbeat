import { Text } from '@cloudflare/kumo'
import { parseWarningText } from '../lib/warningText'

/** One titled part of a warning (Impacts, What you should do…), or nothing when the publisher left it out. */
export function TextPart({ title, children }: { title: string; children: string | null }) {
  if (!children) return null
  return (
    <section className="grid gap-1.5">
      <Text as="h3" variant="heading">
        {title}
      </Text>
      <PublishedText text={children} />
    </section>
  )
}

/** A warning's published text, word for word, laid out as paragraphs and bullet points. */
export function PublishedText({ text }: { text: string }) {
  const blocks = parseWarningText(text)
  return (
    <div className="grid gap-2 text-sm">
      {blocks.map((b, i) =>
        b.kind === 'p' ? (
          <p key={i}>{b.text}</p>
        ) : (
          <ul key={i} className="grid list-disc gap-1 pl-5">
            {b.items.map((it, j) => (
              <li key={j} className={it.nested ? 'ml-4 list-[circle]' : undefined}>
                {it.text}
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  )
}
