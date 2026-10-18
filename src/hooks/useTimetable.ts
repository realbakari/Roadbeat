import { useEffect, useState } from 'react'
import { loadTripsAround, loadTripsOn, type ScheduledTrip } from '../api/timetables'
import type { TransitRegion } from '../api/transitTypes'

/** Published trips on `codes` for one service day (with `calendarDay`, everything that can depart that calendar day); null while loading. */
export function useTripsOn(region: TransitRegion, codes: string[] | null, date: string | null, calendarDay = false) {
  const [state, setState] = useState<{ k: string; trips: ScheduledTrip[] } | null>(null)
  const k = `${region}|${date}|${codes?.join(',')}|${calendarDay}`
  useEffect(() => {
    if (!codes || !date) return
    let live = true
    ;(calendarDay ? loadTripsAround : loadTripsOn)(region, codes, date).then((trips) => live && setState({ k, trips }))
    return () => {
      live = false
    }
  }, [region, codes, date, calendarDay, k])
  return state?.k === k ? state.trips : null
}
