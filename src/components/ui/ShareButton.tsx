import { Button } from '@cloudflare/kumo'
import { CheckIcon, ShareNetworkIcon } from '@phosphor-icons/react'
import { useCopied } from '../../hooks/useCopied'

interface Props {
  /** The item's name, for the share sheet's title. */
  title: string
  /** The publisher's own words for it, with who published it and when (src/lib/shareText.ts). */
  text: string
  url: string
}

/**
 * Shares an item into the places people already talk: the system share sheet
 * where there is one (phones, Safari), otherwise the official wording and the
 * link copied together, ready to paste into a group or a message.
 */
export function ShareButton({ title, text, url }: Props) {
  const [copied, flashCopied] = useCopied(2000)
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch (e) {
        // Closing the sheet isn't an error; any other failure falls back to copying.
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      flashCopied()
    } catch {
      // Clipboard can be blocked; the address bar still holds the link.
    }
  }
  return (
    <Button variant="ghost" size="sm" icon={copied ? <CheckIcon /> : <ShareNetworkIcon />} onClick={share} aria-live="polite" title="Share the official details and a link">
      {copied ? 'Copied' : 'Share'}
    </Button>
  )
}
