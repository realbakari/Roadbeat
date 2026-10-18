import { describe, expect, it } from 'vitest'
import type { CrashFilter } from '../api/crashes'
import { toggleSeverity, withYear } from './crashFilter'

const filter: CrashFilter = { from: 2020, to: 2024, severities: ['Fatal', 'Hospitalisation'] }

describe('withYear', () => {
  it('moves one end of the range', () => {
    expect(withYear(filter, 'from', '2018')).toEqual({ ...filter, from: 2018 })
    expect(withYear(filter, 'to', '2022')).toEqual({ ...filter, to: 2022 })
  })

  it('drags the other end along when one passes it', () => {
    expect(withYear(filter, 'from', '2025')).toEqual({ ...filter, from: 2025, to: 2025 })
    expect(withYear(filter, 'to', '2015')).toEqual({ ...filter, from: 2015, to: 2015 })
  })

  it('ignores a value that is not a year', () => {
    expect(withYear(filter, 'from', null)).toBe(filter)
    expect(withYear(filter, 'to', 'soon')).toBe(filter)
  })
})

describe('toggleSeverity', () => {
  it('switches a severity on or off', () => {
    expect(toggleSeverity(filter, 'Minor injury').severities).toEqual(['Fatal', 'Hospitalisation', 'Minor injury'])
    expect(toggleSeverity(filter, 'Fatal').severities).toEqual(['Hospitalisation'])
  })

  it('keeps the last severity on', () => {
    const one: CrashFilter = { ...filter, severities: ['Fatal'] }
    expect(toggleSeverity(one, 'Fatal')).toBe(one)
  })
})
