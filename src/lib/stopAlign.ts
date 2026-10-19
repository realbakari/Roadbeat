import type { ScheduledStop } from '../api/timetables'
import type { StopTime } from '../api/transitTypes'

/**
 * Pairs each published stop of a trip with the stop Translink's real-time
 * feed reports for that same visit, or null. A loop calls at some stops twice,
 * so a stop id alone can't say which visit the feed means. The feed lists its
 * stops in trip order, so they are matched in that order, as many as possible.
 * GTFS stop sequences only increase, from 0 or more, so a stop the feed numbers
 * `n` can't be later than the trip's (n + 1)th published stop. Where that still
 * leaves a choice, the later visit wins: the feed drops the stops a trip has
 * passed, so a loop that has only its last stop left reports only that one.
 * An exact stop id beats another platform of the same station (`sameStop`).
 */
export function alignStops(
  scheduled: ScheduledStop[],
  reported: StopTime[],
  sameStop: (a: string, b: string) => boolean = (a, b) => a === b,
): (StopTime | null)[] {
  const n = scheduled.length
  const m = reported.length
  const w = n + 1
  // Best score for reported[i..] against scheduled[j..]: matches, then exact ids, then lateness.
  const count = new Float64Array((m + 1) * w)
  const exact = new Float64Array((m + 1) * w)
  const late = new Float64Array((m + 1) * w)
  const better = (a: number, c: number, e: number, l: number) =>
    c > count[a] || (c === count[a] && (e > exact[a] || (e === exact[a] && l > late[a])))
  const take = (a: number, b: number) => {
    count[a] = count[b]
    exact[a] = exact[b]
    late[a] = late[b]
  }
  const fits = (i: number, j: number) => {
    const r = reported[i]
    const s = scheduled[j]
    if (r.sequence != null && j > r.sequence) return 0
    return r.stopId === s.stopId ? 2 : sameStop(r.stopId, s.stopId) ? 1 : 0
  }
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      const a = i * w + j
      take(a, (i + 1) * w + j)
      const skipRow = i * w + j + 1
      if (better(a, count[skipRow], exact[skipRow], late[skipRow])) take(a, skipRow)
      const f = fits(i, j)
      const next = (i + 1) * w + j + 1
      if (f && better(a, count[next] + 1, exact[next] + (f === 2 ? 1 : 0), late[next] + j)) {
        count[a] = count[next] + 1
        exact[a] = exact[next] + (f === 2 ? 1 : 0)
        late[a] = late[next] + j
      }
    }
  }
  const out: (StopTime | null)[] = scheduled.map(() => null)
  let i = 0
  let j = 0
  while (i < m && j < n) {
    const a = i * w + j
    const f = fits(i, j)
    const next = (i + 1) * w + j + 1
    if (f && count[a] === count[next] + 1 && exact[a] === exact[next] + (f === 2 ? 1 : 0) && late[a] === late[next] + j) {
      out[j] = reported[i]
      i++
      j++
    } else if (count[a] === count[a + 1] && exact[a] === exact[a + 1] && late[a] === late[a + 1]) j++
    else i++
  }
  return out
}
