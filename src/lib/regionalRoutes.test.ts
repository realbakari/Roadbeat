import { describe, expect, it } from 'vitest'
import type { TimetableIndex } from '../api/timetables'
import { regionalRoutes, searchRoutes } from './regionalRoutes'

const region = (routes: string[]) => ({ start: '2026-10-15', days: 61, routes, finals: [], stops: {} })
const index: TimetableIndex = {
  source: 'test',
  generated: '2026-10-16',
  regions: { SEQ: region(['66', 'BRCA']), TSV: region(['V201', 'V200', 'V1000']), NSI: region(['F880']) },
}
const NAMES: Record<string, string> = {
  'TSV:V200': 'Ferry Terminal - City, Stockland and Kelso',
  'TSV:V201': 'Ferry Terminal - City, Stockland and JCU',
  'TSV:V1000': 'Night service',
  'NSI:F880': 'North Stradbroke Island (Point Lookout - Dunwich)',
}
const info = (code: string, r: string) =>
  NAMES[`${r}:${code}`] ? { short: code.slice(1), long: NAMES[`${r}:${code}`], mode: 'bus' as const, color: '#E463A4' } : null

describe('regionalRoutes', () => {
  it('lists every region but SEQ, in feed order, by route number', () => {
    expect(regionalRoutes(index, info).map((r) => `${r.region}:${r.short}`)).toEqual(['NSI:880', 'TSV:200', 'TSV:201', 'TSV:1000'])
  })

  it('keeps the code when the route data has no entry', () => {
    const routes = regionalRoutes(index, () => null)
    expect(routes[0]).toMatchObject({ code: 'F880', short: 'F880', long: '', mode: 'bus', color: null })
  })
})

describe('searchRoutes', () => {
  const routes = regionalRoutes(index, info)
  it('finds a route by number, then by region, then by name', () => {
    expect(searchRoutes(routes, '200').map((r) => r.code)).toEqual(['V200'])
    expect(searchRoutes(routes, 'townsville').map((r) => r.code)).toEqual(['V200', 'V201', 'V1000'])
    expect(searchRoutes(routes, 'kelso').map((r) => r.code)).toEqual(['V200'])
    expect(searchRoutes(routes, 'dunwich').map((r) => r.code)).toEqual(['F880'])
  })

  it('needs two characters and matches whole words in names', () => {
    expect(searchRoutes(routes, '2')).toEqual([])
    expect(searchRoutes(routes, 'elso')).toEqual([])
  })
})
