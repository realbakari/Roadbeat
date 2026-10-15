export type WarningBlock = { kind: 'p'; text: string } | { kind: 'ul'; items: { text: string; nested: boolean }[] }

/**
 * Splits plain warning text into paragraphs and bullet lists without changing
 * its wording: blank lines separate paragraphs, lines starting "- " become
 * bullet points, and indented "- " lines become nested points.
 */
export function parseWarningText(text: string): WarningBlock[] {
  const blocks: WarningBlock[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) continue
    const bullet = line.match(/^(\s*)-\s+(.*)$/)
    if (!bullet) {
      blocks.push({ kind: 'p', text: line.trim() })
      continue
    }
    const item = { text: bullet[2], nested: bullet[1].length > 0 }
    const last = blocks.at(-1)
    if (last?.kind === 'ul') last.items.push(item)
    else blocks.push({ kind: 'ul', items: [item] })
  }
  return blocks
}
