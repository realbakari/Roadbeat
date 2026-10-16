import { useState } from 'react'

/** Clamped lines are a per-block setting, so Tailwind sees each class spelled out. */
const CLAMP = { 2: 'line-clamp-2', 3: 'line-clamp-3' } as const

/**
 * Text clamped to a few lines with a "More" link to read the rest, for long
 * published notes that would otherwise swamp a small card. Short text shows
 * as is. The whole text is always in the page, so screen readers and search
 * see it; only the drawing is clamped.
 */
export function ClampedText({ text, lines = 2, className = '' }: { text: string; lines?: keyof typeof CLAMP; className?: string }) {
  const [open, setOpen] = useState(false)
  // Roughly a line's worth at 14px in a 300px card; anything shorter needs no link.
  const long = text.length > lines * 60
  return (
    <span className={`block min-w-0 ${className}`}>
      <span className={`block break-words ${open || !long ? '' : CLAMP[lines]}`}>{text}</span>
      {long && (
        <button type="button" className="mt-0.5 text-xs font-medium text-kumo-link hover:underline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? 'Less' : 'More'}
        </button>
      )}
    </span>
  )
}
