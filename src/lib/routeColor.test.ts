import { describe, expect, it } from 'vitest'
import { readableTextOn } from './routeColor'

describe('readableTextOn', () => {
  it('uses dark text on TransLink yellow (T5, G:link)', () => {
    expect(readableTextOn('#FFC425')).toBe('#1d1d1d')
  })

  it('uses dark text on light blue (T2)', () => {
    expect(readableTextOn('#6CC6E9')).toBe('#1d1d1d')
  })

  it('uses white text on the darker line colours', () => {
    expect(readableTextOn('#27855A')).toBe('#ffffff') // T1 green
    expect(readableTextOn('#4778B2')).toBe('#ffffff') // T4 blue
    expect(readableTextOn('#9B60A6')).toBe('#ffffff') // T3 purple
    expect(readableTextOn('#D53E45')).toBe('#ffffff') // T6 red
  })

  it('falls back to white for anything that is not a 6-digit hex colour', () => {
    expect(readableTextOn('red')).toBe('#ffffff')
    expect(readableTextOn('')).toBe('#ffffff')
  })
})
