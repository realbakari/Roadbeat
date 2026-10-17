import { describe, expect, it } from 'vitest'
import { fireIcon, iconUrl } from './mapIcons'

describe('fireIcon', () => {
  it("picks the icon from QFD's published incident type and the warning level", () => {
    expect(fireIcon('Advice', 'FIRE VEGETATION')).toBe('fire-advice')
    expect(fireIcon('Information', 'FIRE PERMITTED BURN')).toBe('fire-information-burn')
    expect(fireIcon('Watch and Act', null)).toBe('fire-watch-and-act')
  })

  it('has a drawn icon for a planned burn at every level', () => {
    for (const level of ['Emergency Warning', 'Watch and Act', 'Advice', 'Information']) {
      expect(decodeURIComponent(iconUrl(fireIcon(level, 'FIRE PERMITTED BURN')))).toContain('<svg')
      expect(iconUrl(fireIcon(level, 'FIRE PERMITTED BURN'))).not.toBe(iconUrl(fireIcon(level)))
    }
  })
})
