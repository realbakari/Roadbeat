import { useEffect, useState } from 'react'

/** Chromium's install prompt event. Not in TypeScript's DOM types because only Chromium browsers fire it. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const isPromptEvent = (e: Event): e is BeforeInstallPromptEvent => 'prompt' in e && 'userChoice' in e

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

// iPadOS reports itself as a Mac, so a touch screen on "MacIntel" means an iPad.
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/**
 * How Roadbeat can be installed in this browser.
 * `prompt`: Chromium's own install dialog is ready. `ios`: the user adds it from the Share menu.
 * `none`: already installed, or the browser offers no way to install.
 */
export function useInstallApp() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      if (!isPromptEvent(e)) return
      e.preventDefault()
      setPromptEvent(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    // A prompt event can only be used once; the browser fires a new one if the user dismissed it.
    setPromptEvent(null)
    if (outcome === 'accepted') setInstalled(true)
  }

  const mode: 'prompt' | 'ios' | 'none' = installed ? 'none' : promptEvent ? 'prompt' : isIos() ? 'ios' : 'none'
  return { mode, install }
}
