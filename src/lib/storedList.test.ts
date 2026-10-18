import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isSavedStop } from './savedStops'
import { storedList } from './storedList'

let items: Record<string, string>

beforeEach(() => {
  items = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => items[k] ?? null,
    setItem: (k: string, v: string) => {
      items[k] = v
    },
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('storedList', () => {
  it('writes through to storage and reads back what was written', () => {
    const list = storedList<number>('test-list')
    expect(list.read()).toEqual([])
    list.write([1, 2])
    expect(items['test-list']).toBe('[1,2]')
    expect(storedList<number>('test-list').read()).toEqual([1, 2])
  })

  it('reads unreadable or non-list storage as an empty list', () => {
    items['bad-json'] = '{'
    items['not-list'] = '{"a":1}'
    expect(storedList('bad-json').read()).toEqual([])
    expect(storedList('not-list').read()).toEqual([])
  })

  it('keeps only entries the guard accepts', () => {
    items['qldt-saved-stops'] = JSON.stringify([{ region: 'SEQ', id: '600029' }, { region: 'XYZ', id: '1' }, { id: 2 }, null])
    expect(storedList('qldt-saved-stops', isSavedStop).read()).toEqual([{ region: 'SEQ', id: '600029' }])
  })
})
