import { describe, expect, it } from 'vitest'
import { parseWarningText } from './warningText'

describe('parseWarningText', () => {
  it('turns dash lines into bullets and keeps paragraphs, word for word', () => {
    const text = 'Stay informed.\n\n- Check for updates.\n\n- Close windows.\n\n  - Lifeline on 13 11 14.\n\nUpdates will be issued.'
    expect(parseWarningText(text)).toEqual([
      { kind: 'p', text: 'Stay informed.' },
      {
        kind: 'ul',
        items: [
          { text: 'Check for updates.', nested: false },
          { text: 'Close windows.', nested: false },
          { text: 'Lifeline on 13 11 14.', nested: true },
        ],
      },
      { kind: 'p', text: 'Updates will be issued.' },
    ])
  })
})
