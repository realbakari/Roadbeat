import { describe, expect, it } from 'vitest'
import { inPageNav, splitLead } from './pageLayout.ts'

describe('splitLead', () => {
  it('takes the title and its first paragraph for the banner', () => {
    expect(splitLead('<h1>About</h1>\n<p>Roadbeat is free.</p>\n<h2 id="a">A</h2>')).toEqual({ title: 'About', lead: 'Roadbeat is free.', body: '<h2 id="a">A</h2>' })
  })

  it('leaves a title with no paragraph after it, and a page with no title', () => {
    expect(splitLead('<h1>Places</h1>\n<h2 id="a">A</h2>')).toEqual({ title: 'Places', lead: null, body: '<h2 id="a">A</h2>' })
    expect(splitLead('<p>Hi</p>')).toEqual({ title: null, lead: null, body: '<p>Hi</p>' })
  })
})

describe('inPageNav', () => {
  const sections = (n: number) => Array.from({ length: n }, (_, i) => `<h2 id="s${i}">Section ${i}</h2>`).join('\n')

  it('lists the sections of a page with three to twelve of them', () => {
    const nav = inPageNav(sections(3))
    expect(nav).toContain('<nav class="toc" aria-labelledby="on-this-page">')
    expect(nav).toContain('<li><a href="#s2">Section 2</a></li>')
  })

  it('leaves out the list for short pages and for indexes with a jump list of their own', () => {
    expect(inPageNav(sections(2))).toBe('')
    expect(inPageNav(sections(13))).toBe('')
  })

  it('keeps entities in heading text as they were', () => {
    expect(inPageNav(`${sections(2)}\n<h2 id="q">Questions &amp; answers</h2>`)).toContain('>Questions &amp; answers<')
  })
})
