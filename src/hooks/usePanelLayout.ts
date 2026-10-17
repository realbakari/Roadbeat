import { useCallback, useEffect, useRef, useState } from 'react'

/** The ids of the two views, which take focus when switching hides the focused element. */
export const VIEW_IDS = { list: 'list-view', map: 'map-view' } as const

/** Desktop panel: today's width, full screen for detail, or closed for a full map. */
export type PanelMode = 'normal' | 'expanded' | 'closed'

function readPanelMode(): PanelMode {
  try {
    const v = localStorage.getItem('qldt-panel')
    return v === 'expanded' || v === 'closed' ? v : 'normal'
  } catch {
    return 'normal'
  }
}

/**
 * Which of the side panel and the map is showing: on phones a List or Map view,
 * on desktop the panel mode, remembered per browser. Escape leaves full screen.
 */
export function usePanelLayout() {
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')
  const [panelMode, setPanelModeState] = useState<PanelMode>(readPanelMode)
  const setPanelMode = useCallback((m: PanelMode | ((m: PanelMode) => PanelMode)) => {
    setPanelModeState((prev) => {
      const next = typeof m === 'function' ? m(prev) : m
      try {
        localStorage.setItem('qldt-panel', next)
      } catch {
        // Storage blocked: the choice lasts for this visit.
      }
      return next
    })
  }, [])
  /** Shows the map: on phones the Map view, on desktop leaving full-screen panel mode. */
  const revealMap = useCallback(() => {
    setMobileView('map')
    setPanelMode((m) => (m === 'expanded' ? 'normal' : m))
  }, [setPanelMode])
  /** Shows the panel: on phones the List view, on desktop reopening it if closed. */
  const revealList = useCallback(() => {
    setMobileView('list')
    setPanelMode((m) => (m === 'closed' ? 'normal' : m))
  }, [setPanelMode])
  // On phones the view being left is display:none, so whatever had focus in it is lost and
  // focus falls to the page. Move it to the view now shown, unless it is still somewhere visible.
  const shownView = useRef(mobileView)
  useEffect(() => {
    if (shownView.current === mobileView) return
    shownView.current = mobileView
    const active = document.activeElement
    if (active && active !== document.body && active.checkVisibility()) return
    document.getElementById(VIEW_IDS[mobileView])?.focus()
  }, [mobileView])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (document.querySelector('[role="dialog"], [role="listbox"]')) return // let open dialogs and menus close first
      setPanelMode((m) => (m === 'expanded' ? 'normal' : m))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPanelMode])
  return { mobileView, panelMode, setPanelMode, revealMap, revealList }
}
