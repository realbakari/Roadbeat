import { z } from 'zod'

// What a person sends from the app's feedback form, and what is kept of it.
// No address, browser or account is stored: only what they typed, which page
// they were on and when. Contact details are optional and only kept if given.

const FEEDBACK_KINDS = ['bug', 'idea', 'data', 'other'] as const

/** At most this many messages a day from one browser and address (hashed, as for visits). */
export const PER_DAY = 5
/** At most this many messages kept; the oldest go first. */
export const KEEP = 2000

// Control characters other than tab and newline are dropped, so a message reads as plain text wherever it's shown.
const isControl = (c: string) => {
  const n = c.charCodeAt(0)
  return (n < 32 && c !== '\t' && c !== '\n') || n === 127
}
const plain = (s: string) => [...s].filter((c) => !isControl(c)).join('').trim()

export const FeedbackInput = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().transform(plain).pipe(z.string().min(10, 'Write at least a sentence.').max(2000)),
  contact: z
    .string()
    .transform(plain)
    .pipe(z.union([z.literal(''), z.email().max(200)]))
    .optional(),
  /** The app view it was sent from, e.g. "#event/829592". */
  page: z.string().max(200).transform(plain).optional(),
  /** A field people never see. A bot that fills every field fills this one too. */
  website: z.string().max(200).optional(),
})
export type FeedbackInput = z.infer<typeof FeedbackInput>

export interface FeedbackRecord {
  at: number
  kind: FeedbackInput['kind']
  message: string
  contact: string | null
  page: string | null
}

/** The record kept for a message, or null when the hidden field was filled (a bot). */
export function feedbackRecord(input: FeedbackInput, now: number): FeedbackRecord | null {
  if (input.website) return null
  return { at: now, kind: input.kind, message: input.message, contact: input.contact || null, page: input.page || null }
}
