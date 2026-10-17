import { describe, expect, it } from 'vitest'
import { parseTcw } from '../api/jtwc'
import { parseQldWarnings } from '../api/qldWarnings'
import SAMPLES from '../test/qldWarnings.json'
import { parseDismissed, satelliteSuggestion } from './satelliteSuggestion'

// A JTWC .tcw head in the published JMV 3.0 shape, for a storm in the Coral Sea.
const CORAL_SEA = `WTPS31 PGTW 170900
WARNING    ATCG MIL 03P SWP 261017082145
2026101706 03P ALFRED     005  01 160 12 SATL 060
T000 168S 1552E 060 R050 035 NE QD 035 SE QD 000 SW QD 000 NW QD
T012 172S 1540E 070 R064 010 NE QD 010 SE QD 000 SW QD 010 NW QD
AMP`
// The same storm far out in the Pacific, outside 90° to 170° E.
const PACIFIC = CORAL_SEA.replace(/1552E/, '1632W').replace(/1540E/, '1626W').replace(/03P ALFRED/, '01P WATI  ')

const coralSea = parseTcw(CORAL_SEA, 'https://www.metoc.navy.mil/jtwc/products/sh0326.tcw')!
const pacific = parseTcw(PACIFIC, 'https://www.metoc.navy.mil/jtwc/products/sh0127.tcw')!
const [isisford] = parseQldWarnings(SAMPLES.live)
const thunderstorm = { ...isisford, id: 'BN_17102026', type: 'Severe Thunderstorm', area: 'Brisbane', levelText: 'Watch and Act', level: 'Watch and Act' as const }

describe('satelliteSuggestion', () => {
  it('suggests the satellite view for a JTWC storm near Australia', () => {
    expect(satelliteSuggestion([coralSea], [], [])).toEqual({ key: 'cyclone:03P', text: 'Cyclone Alfred near Australia (JTWC): show the live satellite view?' })
  })

  it('leaves out storms outside the region and warnings of other types', () => {
    expect(satelliteSuggestion([pacific], [isisford], [])).toBeNull()
  })

  it('puts a Queensland storm warning first, by its published type and level', () => {
    expect(satelliteSuggestion([coralSea], [thunderstorm], [])).toEqual({
      key: 'warning:BN_17102026',
      text: 'Watch and Act: Severe Thunderstorm warning for Brisbane. Show the live satellite view?',
    })
  })

  it('stays quiet about anything dismissed', () => {
    expect(satelliteSuggestion([coralSea], [thunderstorm], ['warning:BN_17102026'])?.key).toBe('cyclone:03P')
    expect(satelliteSuggestion([coralSea], [thunderstorm], ['warning:BN_17102026', 'cyclone:03P'])).toBeNull()
  })
})

describe('parseDismissed', () => {
  it('reads a stored list and ignores anything else', () => {
    expect(parseDismissed('["cyclone:03P"]')).toEqual(['cyclone:03P'])
    expect(parseDismissed('{"a":1}')).toEqual([])
    expect(parseDismissed('not json')).toEqual([])
    expect(parseDismissed(null)).toEqual([])
  })
})
