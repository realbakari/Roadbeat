import { useEffect, useState } from 'react'
import { fetchCorridors, fetchCouncilEvents, fetchPedestrianDay, type Corridor, type CorridorMonth, type CouncilEvent, type PedestrianHour } from '../api/bccDashboard'

import { brisbaneMidnight } from '../lib/councilEvents'

const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' })
const HOUR = 3600_000

/** Polls `load` every `every` ms while the page is visible, keeping the last good result. */
function usePoll<T>(load: (signal: AbortSignal) => Promise<T>, every: number) {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    const c = new AbortController()
    const run = () => load(c.signal).then(setData, () => {})
    run()
    const id = setInterval(() => document.visibilityState === 'visible' && run(), every)
    return () => {
      c.abort()
      clearInterval(id)
    }
    // `load` is a module-level function per caller, so it never changes.
  }, [load, every])
  return data
}

const loadCorridors = (signal: AbortSignal) => fetchCorridors(Date.now(), signal)
// Today and tomorrow, so the dashboard can show tomorrow's once today's have finished.
const loadEvents = (signal: AbortSignal) => {
  const start = brisbaneMidnight(Date.now())
  return fetchCouncilEvents(start, start + 48 * HOUR, signal)
}
const loadFootTrafficYesterday = async (signal: AbortSignal) => {
  const date = day.format(Date.now() - 24 * HOUR)
  return { date, hours: await fetchPedestrianDay(date, signal) }
}

/** The council's corridor results (monthly), today's and tomorrow's events, and yesterday's pedestrian counts (daily), for the dashboard. */
export function useCouncilDashboard(): {
  corridors: { corridors: Corridor[]; months: CorridorMonth[] } | null
  events: CouncilEvent[] | null
  pedestrians: { date: string; hours: PedestrianHour[] } | null
} {
  return {
    corridors: usePoll(loadCorridors, 6 * HOUR),
    events: usePoll(loadEvents, 15 * 60_000),
    pedestrians: usePoll(loadFootTrafficYesterday, HOUR),
  }
}
