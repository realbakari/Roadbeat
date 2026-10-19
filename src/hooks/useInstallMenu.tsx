import { DropdownMenu } from '@cloudflare/kumo'
import { DeviceMobileIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { InstallSteps } from '../components/InstallApp'
import { useInstallApp } from './useInstallApp'

/**
 * Installing Roadbeat from the header's More menu. Chrome and Edge show their
 * own install prompt too; the item opens it on demand. iPhone and iPad Safari
 * never prompt, so there it opens the Add to Home Screen steps. The header calls
 * this, because it's always there: the menu's items exist only while it's open,
 * and the browser's install event fires once, at load.
 */
export function useInstallMenu() {
  const { mode, install } = useInstallApp()
  const [stepsOpen, setStepsOpen] = useState(false)
  const item =
    mode === 'none' ? null : (
      <DropdownMenu.Item icon={DeviceMobileIcon} onClick={() => (mode === 'prompt' ? void install() : setStepsOpen(true))}>
        Install Roadbeat
      </DropdownMenu.Item>
    )
  return { item, steps: <InstallSteps open={stepsOpen} onOpenChange={setStepsOpen} /> }
}
