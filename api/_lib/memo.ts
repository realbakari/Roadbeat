// One read of a slow upstream shared by every request to a warm function for a
// while. The promise is kept, not its value, so requests that arrive while a read
// is under way wait for that read instead of starting their own.

/**
 * Wraps `load` so it runs at most once per `ttlMs`. A read that fails is
 * forgotten, so the next request tries again. `load` gets the previous read, for
 * a source that builds on what it had before.
 */
export function memoised<T>(ttlMs: number, load: (previous: Promise<T> | null, now: number) => Promise<T>): (now?: number) => Promise<T> {
  let last: { at: number; value: Promise<T> } | null = null
  return (now = Date.now()) => {
    if (!last || now - last.at >= ttlMs) {
      const value = load(last?.value ?? null, now)
      last = { at: now, value }
      // Only this read is forgotten: a newer one may have replaced it by the time it fails.
      value.catch(() => {
        if (last?.value === value) last = null
      })
    }
    return last.value
  }
}
