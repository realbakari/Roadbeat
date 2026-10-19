import { useEffect, useState } from 'react'
import { loadLocalities, lookupLocality } from '../api/localities'
import { localityIndex, type Locality } from '../lib/locality'

/**
 * The gazetteer locality a #place/locality/<name> link names. The gazetteer is
 * loaded on the first lookup, in its own chunk. `found` is null while the lookup
 * runs or when no locality has the name; `loading` tells the two apart.
 */
export function useLocality(name: string | null): { found: Locality | null; loading: boolean } {
  const [state, setState] = useState<{ name: string; found: Locality | null } | null>(null)
  useEffect(() => {
    if (!name) return
    let live = true
    lookupLocality(name).then(
      (found) => live && setState({ name, found }),
      () => live && setState({ name, found: null }),
    )
    return () => {
      live = false
    }
  }, [name])
  if (!name) return { found: null, loading: false }
  if (state?.name !== name) return { found: null, loading: true }
  return { found: state.found, loading: false }
}

/**
 * The gazetteer indexed for matching place names other sources publish, so
 * event cards can link their places. It's read once the browser is idle, as
 * nothing on screen waits for it; null until then, when places show as text.
 */
export function useLocalityIndex(): Map<string, Locality[]> | null {
  const [index, setIndex] = useState<Map<string, Locality[]> | null>(null)
  useEffect(() => {
    let live = true
    const load = () => loadLocalities().then((list) => live && setIndex(localityIndex(list)), () => {})
    // Older Safari has no requestIdleCallback; a short delay keeps the load off the first paint there.
    const whenIdle: typeof window.requestIdleCallback | undefined = window.requestIdleCallback
    const idle = whenIdle ? whenIdle(load, { timeout: 5_000 }) : null
    const timer = idle == null ? window.setTimeout(load, 2_000) : null
    return () => {
      live = false
      if (idle != null) window.cancelIdleCallback(idle)
      if (timer != null) window.clearTimeout(timer)
    }
  }, [])
  return index
}
