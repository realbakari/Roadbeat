import { describe, expect, it } from 'vitest'
import { stripHtml } from './format'

describe('stripHtml', () => {
  it('turns paragraphs and breaks into lines and decodes character references', () => {
    expect(stripHtml('<p>Bookings required via the <a href="https://x.test">website</a>.</p><p>Seats&#160;are   limited &amp; sell out.<br>Arrive early.</p>')).toBe(
      'Bookings required via the website.\nSeats are limited & sell out.\nArrive early.',
    )
  })

  it('leaves plain text alone apart from trimming', () => {
    expect(stripHtml('  No bookings required.  ')).toBe('No bookings required.')
  })
})
