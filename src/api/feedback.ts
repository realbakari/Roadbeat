// The app's feedback form, sent to Roadbeat's own /api/feedback
// (api/_lib/endpoints/feedback.ts). Only what the person types is kept, with
// the page they were on; an email is optional, for a reply.

export const FEEDBACK_KIND_LABEL = {
  idea: 'Feature request',
  bug: 'Something is broken',
  data: 'Information looks wrong',
  other: 'Something else',
} as const
export type FeedbackKind = keyof typeof FEEDBACK_KIND_LABEL

export interface FeedbackDraft {
  kind: FeedbackKind
  message: string
  contact: string
  /** A field hidden from people; left empty. */
  website: string
}

/** Sends the message; resolves to null when kept, or the server's reason it wasn't. */
export async function sendFeedback(draft: FeedbackDraft, page: string): Promise<string | null> {
  try {
    const res = await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...draft, page }) })
    if (res.ok) return null
    const body = (await res.json().catch(() => null)) as { error?: string; issues?: string[] } | null
    return [body?.error, ...(body?.issues ?? [])].filter(Boolean).join(' ') || `The server answered ${res.status}.`
  } catch {
    return "Couldn't reach Roadbeat. Check your connection and try again."
  }
}
