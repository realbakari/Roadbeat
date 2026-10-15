import { describe, expect, it } from 'vitest'
import { decodeEntities, firstSentence, isQueenslandItem, plainText, wholeSummary } from './newsText'

describe('plainText', () => {
  it('drops tags, decodes entities and collapses whitespace', () => {
    expect(plainText('<p>Fridges &amp; extra&#8217;s\n  <b>weight</b> &#x2014; ok</p>')).toBe('Fridges & extra’s weight — ok')
    expect(decodeEntities('&unknown; &lt;')).toBe('&unknown; <')
  })

  it('drops tags that a feed escaped as entities', () => {
    expect(plainText('&lt;p&gt;Want this? &lt;a href="https://x"&gt;Sign up&lt;/a&gt;&lt;/p&gt;')).toBe('Want this? Sign up')
  })
})

describe('firstSentence', () => {
  it('keeps only the first sentence', () => {
    expect(
      firstSentence(
        'A man has been charged following a single motorbike traffic crash at Burpengary East last night, 15 October. It will be alleged about 8.25pm, a black Suzuki [&#8230;]',
      ),
    ).toBe('A man has been charged following a single motorbike traffic crash at Burpengary East last night, 15 October.')
  })

  it("doesn't end a sentence at an abbreviation, an initial or a time", () => {
    expect(firstSentence('Police were called to Mt. Isa at 8 a.m. Friday after J. Smith rang. Later text.')).toBe(
      'Police were called to Mt. Isa at 8 a.m. Friday after J. Smith rang.',
    )
  })

  it('ends at a question or exclamation, and before a quote', () => {
    expect(firstSentence('Is this the end? "No," he said.')).toBe('Is this the end?')
  })

  it('cuts a very long sentence at a word', () => {
    const s = firstSentence(`${'word '.repeat(100)}end.`)!
    expect(s.length).toBeLessThanOrEqual(281)
    expect(s.endsWith('word…')).toBe(true)
  })

  it('returns null for an empty summary', () => {
    expect(firstSentence('  <p></p> ')).toBeNull()
  })
})

describe('isQueenslandItem', () => {
  const base = { title: 'Trump cancels livestream', summary: 'A poll found…', link: 'https://example.com/world/trump', categories: ['World'] }

  it('keeps items that name Queensland, or are filed under Queensland or Brisbane', () => {
    expect(isQueenslandItem({ ...base, title: 'Storms forecast for parts of Queensland' })).toBe(true)
    expect(isQueenslandItem({ ...base, summary: 'The Qld government said…' })).toBe(true)
    expect(isQueenslandItem({ ...base, categories: ['Politics / Queensland'] })).toBe(true)
    expect(isQueenslandItem({ ...base, link: 'https://www.abc.net.au/news/2026-10-16/queensland-weekend-weather/1' })).toBe(true)
  })

  it('drops everything else, including Queensland place names alone', () => {
    expect(isQueenslandItem(base)).toBe(false)
    expect(isQueenslandItem({ ...base, title: 'Manly fans celebrate' })).toBe(false)
  })
})

describe('wholeSummary', () => {
  it("keeps the whole summary and shows the publisher's truncation as an ellipsis", () => {
    expect(wholeSummary('<p>A man has been charged. It will be alleged he travelled along Avaline Boulevard [&#8230;]</p>')).toBe(
      'A man has been charged. It will be alleged he travelled along Avaline Boulevard…',
    )
    expect(wholeSummary('Complete summary.')).toBe('Complete summary.')
  })

  it('cuts a very long summary at a word', () => {
    const s = wholeSummary('word '.repeat(300))!
    expect(s.length).toBeLessThanOrEqual(701)
    expect(s.endsWith('word…')).toBe(true)
  })
})
