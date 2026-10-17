import { describe, expect, it } from 'vitest'
import { FeedbackInput, feedbackRecord } from './feedback'

describe('FeedbackInput', () => {
  it('keeps what was typed as plain text, with optional contact', () => {
    const ok = FeedbackInput.parse({ kind: 'idea', message: '  Add a fuel price layer\u0007 please  ', contact: 'me@example.com', page: '#event/1' })
    expect(ok.message).toBe('Add a fuel price layer please')
    expect(feedbackRecord(ok, 5)).toEqual({ at: 5, kind: 'idea', message: 'Add a fuel price layer please', contact: 'me@example.com', page: '#event/1' })
    expect(feedbackRecord(FeedbackInput.parse({ kind: 'bug', message: 'The map went blank', contact: '' }), 1)?.contact).toBeNull()
  })

  it('refuses short or long messages, unknown kinds and malformed contact', () => {
    expect(FeedbackInput.safeParse({ kind: 'bug', message: 'hi' }).success).toBe(false)
    expect(FeedbackInput.safeParse({ kind: 'bug', message: 'x'.repeat(2001) }).success).toBe(false)
    expect(FeedbackInput.safeParse({ kind: 'spam', message: 'A long enough message' }).success).toBe(false)
    expect(FeedbackInput.safeParse({ kind: 'bug', message: 'A long enough message', contact: 'not an email' }).success).toBe(false)
  })

  it('drops a message whose hidden field was filled', () => {
    expect(feedbackRecord(FeedbackInput.parse({ kind: 'other', message: 'Buy cheap things now', website: 'http://spam.example' }), 1)).toBeNull()
  })
})
