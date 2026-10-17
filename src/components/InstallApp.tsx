import { Button, Dialog } from '@cloudflare/kumo'
import { DeviceMobileIcon, DotsThreeIcon, ExportIcon, PlusSquareIcon, XIcon } from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { useInstallApp } from '../hooks/useInstallApp'

/**
 * Header button to install Roadbeat on a phone or computer. Uses the browser's own install
 * prompt where there is one (Android, Chrome and Edge) and shows Add to Home Screen steps on
 * iPhone and iPad. Renders nothing once installed, or where the browser can't install it.
 */
export function InstallApp() {
  const { mode, install } = useInstallApp()
  const [stepsOpen, setStepsOpen] = useState(false)

  return (
    <>
      {mode !== 'none' && (
        <Button
          variant="secondary"
          size="sm"
          icon={<DeviceMobileIcon />}
          title="Install Roadbeat as an app"
          onClick={() => (mode === 'prompt' ? void install() : setStepsOpen(true))}
        >
          {/* Below 360px the header has no room for the word, so the button keeps its name for screen readers only. */}
          <span className="max-[359px]:sr-only">Install</span>
        </Button>
      )}
      <Dialog.Root open={stepsOpen} onOpenChange={setStepsOpen}>
        <Dialog size="sm" className="grid gap-4 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <Dialog.Title className="text-lg font-semibold text-kumo-strong">Add Roadbeat to your Home Screen</Dialog.Title>
              <Dialog.Description className="text-sm text-kumo-subtle">
                It opens full screen like an app, with its own icon.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              render={(props) => <Button {...props} variant="ghost" shape="square" icon={<XIcon />} aria-label="Close" />}
            />
          </div>
          <ol className="grid gap-3 text-sm text-kumo-default">
            <Step n={1} icon={<ExportIcon size={18} />}>
              Tap the <strong className="font-medium text-kumo-strong">Share</strong> button. In Safari it may be inside the{' '}
              <DotsThreeIcon size={16} className="inline align-text-bottom" aria-label="More" /> menu.
            </Step>
            <Step n={2} icon={<PlusSquareIcon size={18} />}>
              Scroll down and tap <strong className="font-medium text-kumo-strong">Add to Home Screen</strong>.
            </Step>
            <Step n={3} icon={<DeviceMobileIcon size={18} />}>
              Tap <strong className="font-medium text-kumo-strong">Add</strong>. Roadbeat appears on your Home Screen.
            </Step>
          </ol>
        </Dialog>
      </Dialog.Root>
    </>
  )
}

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-lh items-center text-kumo-subtle" aria-hidden>
        {icon}
      </span>
      <span>
        <span className="sr-only">Step {n}: </span>
        {children}
      </span>
    </li>
  )
}
