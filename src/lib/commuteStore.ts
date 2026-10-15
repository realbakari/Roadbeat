import type { Commute } from './commute'
import { storedList } from './savedStops'

// The rider's commute, kept in this browser. `push` records that this browser
// subscribed to push alerts for it (the subscription itself lives with the browser).

export type StoredCommute = Commute & { push?: boolean }

const store = storedList<StoredCommute>('roadbeat-commute')

export function useCommute(): StoredCommute | null {
  return store.use()[0] ?? null
}

export function readCommute(): StoredCommute | null {
  return store.read()[0] ?? null
}

export function saveCommute(c: StoredCommute | null) {
  store.write(c ? [c] : [])
}
