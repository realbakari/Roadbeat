import { describe, expect, it } from 'vitest'
import { regionRouteInfo, routeInfo } from './translink'

describe('route lookups', () => {
  it('regionRouteInfo returns only the region’s own route', () => {
    expect(regionRouteInfo('V200', 'TSV')?.long).toMatch(/Kelso/)
    // SEQ has a route 200; Townsville’s is V200. A Townsville page for "200" must not show Brisbane’s.
    expect(regionRouteInfo('200', 'TSV')).toBeNull()
  })

  it('routeInfo keeps its SEQ fallback for vehicle and alert lookups', () => {
    expect(routeInfo('200', 'TSV')?.long).toBe(routeInfo('200', 'SEQ')?.long)
  })
})
