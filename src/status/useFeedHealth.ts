import { useCallback, useEffect, useRef, useState } from 'react'
import { isProxyError, NOT_YET, type FeedOutcome } from '../lib/feedHealth'
import { FEEDS, type FeedId } from '../lib/feedRegistry'
import { CHECKS } from './feedChecks'

const INTERVAL = 120_000
/** A check that takes longer than this is reported as failed, with the time it took. */
const TIMEOUT = 45_000

export type Outcomes = Record<FeedId, FeedOutcome>

function initial(): Outcomes {
  const out = {} as Outcomes
  for (const f of FEEDS) {
    const check = CHECKS[f.id]
    out[f.id] = { kind: 'unchecked', reason: typeof check === 'function' ? NOT_YET : check.skip }
  }
  return out
}

/**
 * Checks every feed in the registry when first called and every two minutes
 * after, through the app's own fetch functions. Each feed's outcome updates as
 * its check finishes; `check()` runs a round now. A round in progress is left
 * to finish when another starts, so no feed is checked twice at once.
 */
export function useFeedHealth() {
  const [outcomes, setOutcomes] = useState<Outcomes>(initial)
  const [checking, setChecking] = useState(false)
  const [lastRound, setLastRound] = useState<number | null>(null)
  const running = useRef(false)
  const unmounted = useRef(false)

  const check = useCallback(async () => {
    if (running.current) return
    running.current = true
    setChecking(true)
    const settle = (id: FeedId, outcome: FeedOutcome) => !unmounted.current && setOutcomes((o) => ({ ...o, [id]: outcome }))
    await Promise.all(
      FEEDS.map(async (f) => {
        const run = CHECKS[f.id]
        if (typeof run !== 'function') return
        const c = new AbortController()
        const timer = setTimeout(() => c.abort(new Error(`No answer within ${TIMEOUT / 1000} s`)), TIMEOUT)
        try {
          const result = await run(c.signal)
          settle(f.id, { kind: 'ok', checkedAt: Date.now(), publisherTime: result.publisherTime, sources: result.sources ?? null })
        } catch (e) {
          const message = c.signal.aborted && c.signal.reason instanceof Error ? c.signal.reason.message : e instanceof Error ? e.message : String(e)
          settle(f.id, { kind: 'failed', checkedAt: Date.now(), error: message, needsProxy: isProxyError(message) })
        } finally {
          clearTimeout(timer)
        }
      }),
    )
    running.current = false
    if (!unmounted.current) {
      setChecking(false)
      setLastRound(Date.now())
    }
  }, [])

  useEffect(() => {
    unmounted.current = false
    void check()
    const id = setInterval(() => document.visibilityState === 'visible' && void check(), INTERVAL)
    return () => {
      unmounted.current = true
      clearInterval(id)
    }
  }, [check])

  return { outcomes, checking, lastRound, check }
}
