import { useEffect, useState } from 'react'
import { lookupLocality } from '../api/localities'
import type { Locality } from '../lib/locality'

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
