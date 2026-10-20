import { Button, Dialog } from '@cloudflare/kumo'
import { XIcon } from '@phosphor-icons/react'
import { VIEWS } from './navigation'
import { GO_TO } from './useTimelineKeys'

const ROWS: [keys: string[], what: string][] = [
  [['j', 'k'], 'Next or previous post'],
  [['Enter'], 'Open the post'],
  [['m'], 'Show it on the map'],
  [['s'], 'Share it'],
  [['y'], 'Copy its link'],
  [['o'], 'Show or hide its updates'],
  [VIEWS.map((v) => v.key), VIEWS.map((v) => v.label).join(', ')],
  [['/'], 'Search'],
  [['Esc'], 'Back from a post'],
  ...GO_TO.map((g): [string[], string] => [['g', g.key], `Go to ${g.label}`]),
  [['?'], 'This list'],
]

function Key({ children }: { children: string }) {
  return <kbd className="inline-flex min-w-6 justify-center rounded border border-b-2 border-kumo-line bg-kumo-recessed px-1.5 font-mono text-xs text-kumo-default">{children}</kbd>
}

/** The timeline's keyboard shortcuts. */
export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="sm" className="p-0">
        <div className="flex items-center justify-between border-b border-kumo-line px-4 py-3">
          <Dialog.Title className="text-base font-semibold text-kumo-strong">Keyboard shortcuts</Dialog.Title>
          <Dialog.Close aria-label="Close" render={(props) => <Button {...props} variant="ghost" shape="square" size="sm" icon={<XIcon />} aria-label="Close" />} />
        </div>
        <dl className="m-0 divide-y divide-kumo-line px-4">
          {ROWS.map(([keys, what]) => (
            <div key={what} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <dt className="text-kumo-default">{what}</dt>
              <dd className="m-0 flex shrink-0 items-center gap-1">
                {keys.map((k, i) => (
                  <Key key={`${k}-${i}`}>{k}</Key>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </Dialog>
    </Dialog.Root>
  )
}
