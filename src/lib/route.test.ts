import { describe, expect, it } from 'vitest'
import { kioskPath, parsePath, parseHash } from './route'

describe('parseHash', () => {
  it('reads detail pages', () => {
    expect(parseHash('#event/123').event).toBe(123)
    expect(parseHash('#fire/WARN-10208').fire).toBe('WARN-10208')
    expect(parseHash('#gauge/E1594').gauge).toBe('E1594')
    expect(parseHash('#signal/546').signal).toBe('546')
    expect(parseHash('#news/k3j9x2').news).toBe('k3j9x2')
    expect(parseHash('#news').news).toBe('')
  })

  it('reads a locality page apart from other place pages', () => {
    expect(parseHash('#place/locality/Goodna')).toMatchObject({ locality: 'Goodna', place: null })
    expect(parseHash('#place/locality/Mount%20Isa').locality).toBe('Mount Isa')
    expect(parseHash('#place/locality').locality).toBeNull()
    expect(parseHash('#place/rest/long007')).toMatchObject({ locality: null, place: { kind: 'rest', id: 'long007' } })
  })

  it('reads transit pages', () => {
    expect(parseHash('#transit/stop/SEQ/place_censta').transit).toEqual({ kind: 'stop', region: 'SEQ', id: 'place_censta' })
    expect(parseHash('#transit/line/train/T1%20Caboolture').transit).toEqual({ kind: 'line', mode: 'train', name: 'T1 Caboolture' })
  })

  it('reads a shared journey search', () => {
    expect(parseHash('#transit/plan/SEQ/place_fersta/place_dbnsta/2026-10-16/480/arrive').transit).toEqual({
      kind: 'home',
      plan: { region: 'SEQ', from: 'place_fersta', to: 'place_dbnsta', date: '2026-10-16', minutes: 480, arrive: true },
    })
  })

  it('selects nothing for an empty or unknown hash', () => {
    const empty = parseHash('')
    expect([empty.event, empty.fire, empty.gauge, empty.signal, empty.transit, empty.news, empty.locality]).toEqual([null, null, null, null, null, null, null])
    expect(parseHash('#nonsense/1').event).toBeNull()
  })
})

describe('parsePath', () => {
  it('opens the dashboard, the status page, a kiosk board, or the app', () => {
    expect(parsePath('/dashboard')).toEqual({ kind: 'dashboard' })
    expect(parsePath('/dashboard/')).toEqual({ kind: 'dashboard' })
    expect(parsePath('/status')).toEqual({ kind: 'status' })
    expect(parsePath('/status/feeds')).toEqual({ kind: 'app' })
    expect(parsePath(kioskPath('SEQ', 'place_censta'))).toEqual({ kind: 'kiosk', region: 'SEQ', stopId: 'place_censta' })
    expect(parsePath('/kiosk/XYZ/1')).toEqual({ kind: 'app' })
    expect(parsePath('/')).toEqual({ kind: 'app' })
  })
})
