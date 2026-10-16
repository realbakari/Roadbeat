import { describe, expect, it } from 'vitest'
import { kioskPath, parsePath, parseHash, planHash, routeHref } from './route'

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
    expect(parseHash('#transit/trip/SEQ/123-QR%2025_26/BRCA/2026-10-16').transit).toEqual({
      kind: 'trip',
      region: 'SEQ',
      tripId: '123-QR 25_26',
      route: 'BRCA',
      date: '2026-10-16',
    })
    expect(parseHash('#transit/stop/TSV/890001').transit).toEqual({ kind: 'stop', region: 'TSV', id: '890001' })
    expect(parseHash('#transit/stop/XYZ/890001').transit).toEqual({ kind: 'home' })
    expect(parseHash(`#${routeHref('TSV', 'V200')}`).transit).toEqual({ kind: 'route', region: 'TSV', code: 'V200' })
    expect(parseHash('#transit/route/TSV').transit).toEqual({ kind: 'home' })
    expect(parseHash('#transit/trip/SEQ/123').transit).toEqual({ kind: 'trip', region: 'SEQ', tripId: '123', route: null, date: null })
  })

  it('reads a shared journey search', () => {
    expect(parseHash('#transit/plan/SEQ/place_fersta/place_dbnsta/2026-10-16/480/arrive').transit).toEqual({
      kind: 'home',
      plan: { region: 'SEQ', from: 'place_fersta', to: 'place_dbnsta', date: '2026-10-16', minutes: 480, arrive: true, modes: null, direct: false },
    })
  })

  it('round-trips a saved trip with its mode filter', () => {
    const plan = { region: 'SEQ' as const, from: 'place_fersta', to: '1234', date: null, minutes: null, arrive: false, modes: ['train', 'ferry'], direct: true }
    expect(planHash(plan)).toBe('transit/plan/SEQ/place_fersta/1234/now/now/leave/train,ferry,direct')
    expect(parseHash(`#${planHash(plan)}`).transit).toEqual({ kind: 'home', plan })
    expect(parseHash(`#${planHash({ ...plan, modes: null })}`).transit).toEqual({ kind: 'home', plan: { ...plan, modes: null } })
    expect(planHash({ ...plan, modes: null, direct: false })).toBe('transit/plan/SEQ/place_fersta/1234/now/now/leave')
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
    expect(parsePath(kioskPath('NSI', '870000'))).toEqual({ kind: 'kiosk', region: 'NSI', stopId: '870000' })
    expect(parsePath('/kiosk/XYZ/870000')).toEqual({ kind: 'app' })
    expect(parsePath(kioskPath('SEQ', 'place_censta'))).toEqual({ kind: 'kiosk', region: 'SEQ', stopId: 'place_censta' })
    expect(parsePath('/kiosk/XYZ/1')).toEqual({ kind: 'app' })
    expect(parsePath('/')).toEqual({ kind: 'app' })
  })
})
