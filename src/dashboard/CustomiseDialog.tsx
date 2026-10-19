import { Button, Checkbox, Dialog, Text } from '@cloudflare/kumo'
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, LinkIcon, XIcon } from '@phosphor-icons/react'
import { useCopied } from '../hooks/useCopied'
import { DEFAULT_LAYOUT, layoutQuery, movePanel, PANELS, panelsOf, togglePanel, type PanelId, type PanelKind } from '../lib/dashboardLayout'

const KIND_TITLE: Record<PanelKind, string> = { stat: 'Headline numbers', strip: 'Strips', tile: 'Tiles' }

/** Choose and order the dashboard's panels. The link at the bottom reopens this layout anywhere. */
export function CustomiseDialog({ open, onOpenChange, layout, onChange }: { open: boolean; onOpenChange: (open: boolean) => void; layout: PanelId[]; onChange: (l: PanelId[]) => void }) {
  const [copied, flashCopied] = useCopied(2000)
  const link = `${location.origin}/dashboard${layoutQuery(layout)}`
  const copy = () =>
    navigator.clipboard?.writeText(link).then(flashCopied)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="lg" className="flex max-h-[85vh] flex-col p-0">
        <div className="flex items-start justify-between gap-4 border-b border-kumo-line px-5 pt-4 pb-3">
          <div className="grid gap-1">
            <Dialog.Title className="text-lg font-semibold text-kumo-strong">Customise the dashboard</Dialog.Title>
            <Dialog.Description className="text-sm text-kumo-subtle">Choose what to show and in what order. Kept in this browser, and in the link below.</Dialog.Description>
          </div>
          <Dialog.Close aria-label="Close" render={(props) => <Button {...props} variant="ghost" shape="square" icon={<XIcon />} aria-label="Close" />} />
        </div>

        <div className="grid gap-5 overflow-y-auto px-5 py-4">
          {(['stat', 'strip', 'tile'] as const).map((kind) => {
            const shown = panelsOf(layout, kind)
            return (
              <section key={kind} className="grid gap-2">
                <Text as="h3" variant="heading">
                  {KIND_TITLE[kind]}
                </Text>
                <ul className="grid gap-1">
                  {PANELS.filter((p) => p.kind === kind).map((p) => {
                    const on = layout.includes(p.id)
                    const at = shown.indexOf(p.id)
                    return (
                      <li key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-kumo-tint">
                        <Checkbox label={p.title} checked={on} onCheckedChange={() => onChange(togglePanel(layout, p.id))} />
                        <span className="ml-auto hidden truncate text-xs text-kumo-subtle sm:inline">{p.source}</span>
                        <span className="flex shrink-0">
                          <Button size="sm" variant="ghost" shape="square" aria-label={`Move ${p.title} earlier`} icon={<ArrowUpIcon />} disabled={!on || at <= 0} onClick={() => onChange(movePanel(layout, p.id, -1))} />
                          <Button size="sm" variant="ghost" shape="square" aria-label={`Move ${p.title} later`} icon={<ArrowDownIcon />} disabled={!on || at < 0 || at >= shown.length - 1} onClick={() => onChange(movePanel(layout, p.id, 1))} />
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-kumo-line px-5 py-3">
          <Button size="sm" variant="secondary" icon={copied ? <CheckIcon /> : <LinkIcon />} onClick={copy}>
            {copied ? 'Link copied' : 'Copy link to this layout'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onChange(DEFAULT_LAYOUT)}>
            Reset to default
          </Button>
          <code className="ml-auto hidden max-w-[50%] truncate text-xs text-kumo-subtle md:block">{link}</code>
        </div>
      </Dialog>
    </Dialog.Root>
  )
}
