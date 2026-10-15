import { describe, expect, it } from 'vitest'
import { parseSignalVolumes } from './bccSignals'

const csv = [
  'tsc,lane,recorded,ct,ds1,mf1,ds2,mf2,ds3,mf3,ds4,mf4',
  '546,SA-230,2026-10-15T09:30:00+00:00,70,8,2,0,0,8,2,,',
  '546,SA-230,2026-10-15T09:31:00+00:00,70,40,6,12,3,,,,',
  '546,SA-231,2026-10-15T09:30:00+00:00,70,16,3,22,4,,,,',
  '9,SA-266,2026-10-15T09:35:00+00:00,60,,,,,,,,',
].join('\n')

describe('parseSignalVolumes', () => {
  const v = parseSignalVolumes(csv)

  it('keeps the latest cycle per approach', () => {
    const a = v.get('546')!.find((x) => x.id === 'SA-230')!
    expect(a.recorded).toBe(Date.parse('2026-10-15T09:31:00Z'))
    expect(a.lanes).toEqual([
      { ds: 40, vehicles: 6 },
      { ds: 12, vehicles: 3 },
    ])
    expect(a.cycle).toBe(70)
  })

  it('drops approaches with no lane data', () => {
    expect(v.has('9')).toBe(false)
  })

  it('lists approaches in order', () => {
    expect(v.get('546')!.map((a) => a.id)).toEqual(['SA-230', 'SA-231'])
  })
})
