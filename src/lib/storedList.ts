import { useSyncExternalStore } from 'react'

// A small list kept in this browser's localStorage and shared live between
// components (saved stops, trips, places and the commute). The storage keys
// are the rider's saved data: renaming one loses what they saved.

/**
 * A list stored under `key`. `isItem`, when given, keeps only stored entries
 * of the right shape, so a value from an older version or a hand-edit can't
 * reach the app as the wrong type.
 */
export function storedList<T>(key: string, isItem?: (x: unknown) => x is T) {
  const listeners = new Set<() => void>()
  let cache: T[] | null = null
  const load = (): T[] => {
    try {
      const v: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
      if (!Array.isArray(v)) return []
      return isItem ? v.filter(isItem) : (v as T[])
    } catch {
      return []
    }
  }
  const read = (): T[] => (cache ??= load())
  const write = (list: T[]) => {
    cache = list
    try {
      localStorage.setItem(key, JSON.stringify(list))
    } catch {
      // Private mode or blocked storage: keep it for this visit only.
    }
    listeners.forEach((l) => l())
  }
  const use = () =>
    useSyncExternalStore(
      (l) => (listeners.add(l), () => listeners.delete(l)),
      read,
      read,
    )
  return { read, write, use }
}
