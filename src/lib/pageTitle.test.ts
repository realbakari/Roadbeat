import { describe, expect, it } from 'vitest'
import { pageTitle } from './pageTitle'
import { parseHash } from './route'

const base = 'Roadbeat — live Queensland roads and transport'

describe('pageTitle', () => {
  it('keeps the site title on the home view', () => {
    expect(pageTitle(parseHash(''), {}, base)).toBe(base)
  })

  it('names an open event, falling back to its id until it loads', () => {
    expect(pageTitle(parseHash('#event/801565'), { event: 'Centenary Motorway' }, base)).toBe('Centenary Motorway · Roadbeat')
    expect(pageTitle(parseHash('#event/801565'), {}, base)).toBe('Road event 801565 · Roadbeat')
  })

  it('names transit views', () => {
    expect(pageTitle(parseHash('#transit/line/train/T1%20Caboolture'), {}, base)).toBe('T1 Caboolture · Roadbeat')
    expect(pageTitle(parseHash('#transit/stop/SEQ/place_censta'), { stop: 'Central station' }, base)).toBe('Central station · Roadbeat')
    expect(pageTitle(parseHash('#transit'), {}, base)).toBe('Public transport · Roadbeat')
  })

  it('names places and news', () => {
    expect(pageTitle(parseHash('#place/locality/Toowong'), {}, base)).toBe('Toowong · Roadbeat')
    expect(pageTitle(parseHash('#news'), {}, base)).toBe('Queensland news · Roadbeat')
    expect(pageTitle(parseHash('#place/air/cbd'), {}, base)).toBe('Air quality station · Roadbeat')
  })
})
