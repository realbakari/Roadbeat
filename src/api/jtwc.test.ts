import { describe, expect, it } from 'vitest'
import { nearAustralia, parseTcw, tcwLinks } from './jtwc'

// The head of JTWC's sh0127.tcw for TC 01P (Wati), 17 October 2026.
const WATI = `WTPS51 PGTW 170900
WARNING    ATCG MIL 01P SWP 261017082145
2026101706 01P WATI       003  01 160 12 SATL 060
T000 132S 1632W 060 R050 035 NE QD 035 SE QD 000 SW QD 000 NW QD R034 060 NE QD 085 SE QD 070 SW QD 060 NW QD
T012 149S 1626W 070 R064 010 NE QD 010 SE QD 000 SW QD 010 NW QD
T024 166S 1614W 075 R064 020 NE QD 010 SE QD 010 SW QD 020 NW QD
AMP
    060HR BECOMING EXTRATROPICAL`

const URL_ = 'https://www.metoc.navy.mil/jtwc/products/sh0127.tcw'

describe('parseTcw', () => {
  it("reads the warning position and JTWC's forecast points with their times", () => {
    const c = parseTcw(WATI, URL_)!
    expect(c).toMatchObject({ id: '01P', name: 'Wati', warning: 3, issuedAt: Date.UTC(2026, 9, 17, 6), textUrl: 'https://www.metoc.navy.mil/jtwc/products/sh0127web.txt' })
    expect(c.points).toEqual([
      { tau: 0, position: [-163.2, -13.2], validAt: Date.UTC(2026, 9, 17, 6), windKt: 60 },
      { tau: 12, position: [-162.6, -14.9], validAt: Date.UTC(2026, 9, 17, 18), windKt: 70 },
      { tau: 24, position: [-161.4, -16.6], validAt: Date.UTC(2026, 9, 18, 6), windKt: 75 },
    ])
  })

  it('reads an unnamed storm and rejects a file it cannot read', () => {
    const unnamed = WATI.replace('01P WATI       003', '02P 001')
    expect(parseTcw(unnamed, URL_)).toMatchObject({ id: '02P', name: null, warning: 1 })
    expect(parseTcw('nothing here', URL_)).toBeNull()
  })
})

describe('nearAustralia', () => {
  it('keeps Coral Sea storms and drops ones far out in the Pacific', () => {
    expect(nearAustralia(parseTcw(WATI, URL_)!)).toBe(false)
    const coral = parseTcw(WATI.replace(/1632W/, '1550E').replace(/1626W/, '1520E').replace(/1614W/, '1500E'), URL_)!
    expect(nearAustralia(coral)).toBe(true)
    expect(coral.points[0].position).toEqual([155, -13.2])
  })
})

describe('tcwLinks', () => {
  it('finds each storm once in the RSS', () => {
    const rss = `<a href='https://www.metoc.navy.mil/jtwc/products/wp2926.tcw'>JMV 3.0 Data</a> <a href='https://www.metoc.navy.mil/jtwc/products/sh0127.tcw'>x</a> https://www.metoc.navy.mil/jtwc/products/sh0127.tcw`
    expect(tcwLinks(rss)).toEqual(['https://www.metoc.navy.mil/jtwc/products/wp2926.tcw', 'https://www.metoc.navy.mil/jtwc/products/sh0127.tcw'])
  })
})
