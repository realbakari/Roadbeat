import { describe, expect, it } from 'vitest'
import { cdata, xmlTag, xmlText } from './xml'

describe('xml', () => {
  it('reads the first element with or without attributes, unwrapping CDATA', () => {
    expect(xmlTag('<item><title type="html"><![CDATA[Road <b>closed</b>]]></title><title>Second</title></item>', 'title')).toBe('Road <b>closed</b>')
    expect(xmlTag('<dc:date> 2026-10-17 </dc:date>', 'dc:date')).toBe('2026-10-17')
  })
  it("doesn't take an element whose name only starts the same", () => {
    expect(xmlTag('<content-type>x</content-type>', 'content')).toBeNull()
  })
  it('decodes entities only when asked', () => {
    expect(xmlTag('<name>Smith &amp; Jones &#8211; Rd</name>', 'name')).toBe('Smith &amp; Jones &#8211; Rd')
    expect(xmlText('<name>Smith &amp; Jones &#8211; Rd</name>', 'name')).toBe('Smith & Jones – Rd')
    expect(xmlText('<item></item>', 'name')).toBeNull()
  })
  it('unwraps every CDATA section', () => {
    expect(cdata('<![CDATA[a]]> and <![CDATA[b]]>')).toBe('a and b')
  })
})
