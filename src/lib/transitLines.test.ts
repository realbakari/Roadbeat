import { describe, expect, it } from 'vitest'
import type { TimetableIndex } from '../api/timetables'
import { timetableCodes } from './transitLines'

// A small line: own trains CABR (Caboolture → Brisbane) and BRCA, plus two through
// routes from beyond Caboolture: NABR (stops everywhere) and GYBR (express past Morayfield).
const routes = ['CABR', 'BRCA', 'NABR', 'GYBR']
const at = (...codes: string[]) => codes.map((c) => routes.indexOf(c).toString(36)).join('.')
const index = {
  regions: {
    SEQ: {
      start: '2026-10-01',
      days: 60,
      routes,
      finals: ['place_romsta', 'place_cabstn', 'place_romsta', 'place_romsta'],
      stops: {
        place_nambou: at('NABR', 'GYBR'),
        place_cabstn: at('CABR', 'BRCA', 'NABR', 'GYBR'),
        place_morsta: at('CABR', 'BRCA', 'NABR'),
        place_romsta: at('CABR', 'BRCA', 'NABR', 'GYBR'),
      },
    },
  },
} as unknown as TimetableIndex

describe('timetableCodes', () => {
  it("adds through trains that stop at every one of the line's stations, as Translink's timetables do", () => {
    expect(timetableCodes(['CABR', 'BRCA'], index, 'train')).toEqual(['CABR', 'BRCA', 'NABR'])
  })

  it('leaves buses and other modes as they are', () => {
    expect(timetableCodes(['402'], index, 'bus')).toEqual(['402'])
  })
})
