import { Button, Dialog, Input, Select, Text, Textarea } from '@cloudflare/kumo'
import { CheckCircleIcon, XIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { FEEDBACK_KIND_LABEL, sendFeedback, type FeedbackDraft, type FeedbackKind } from '../api/feedback'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EMPTY: FeedbackDraft = { kind: 'idea', message: '', contact: '', website: '' }

/** "Send feedback": a bug report or feature request, kept for Roadbeat's maintainer to read. */
export function FeedbackDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="lg" className="flex max-h-[85vh] flex-col p-0">
        {/* Keyed on `open` so each opening starts a fresh message. */}
        <FeedbackForm key={String(open)} onClose={() => onOpenChange(false)} />
      </Dialog>
    </Dialog.Root>
  )
}

function FeedbackForm({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<FeedbackDraft>(EMPTY)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const set = <K extends keyof FeedbackDraft>(k: K, v: FeedbackDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const long = draft.message.trim().length >= 10

  const send = async () => {
    setSending(true)
    setError(null)
    const problem = await sendFeedback(draft, location.hash || '/')
    setSending(false)
    if (problem) setError(problem)
    else setSent(true)
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-kumo-line px-5 pt-4 pb-3">
        <div className="grid gap-1">
          <Dialog.Title className="text-lg font-semibold text-kumo-strong">Send feedback</Dialog.Title>
          <Dialog.Description className="text-sm text-kumo-subtle">Report a problem with Roadbeat, or suggest something it should do.</Dialog.Description>
        </div>
        <Dialog.Close aria-label="Close" render={(props) => <Button {...props} variant="ghost" shape="square" icon={<XIcon />} aria-label="Close" />} />
      </div>

      {sent ? (
        <div className="grid gap-3 px-5 py-6" role="status">
          <CheckCircleIcon size={32} weight="fill" className="text-kumo-success" aria-hidden />
          <Text>Thanks, your message was sent.</Text>
          <Text size="sm" variant="secondary">
            {draft.contact ? `If it needs a reply, it'll go to ${draft.contact}.` : "You didn't leave an email, so there won't be a reply, but it will be read."}
          </Text>
        </div>
      ) : (
        <form
          id="feedback-form"
          className="grid gap-4 overflow-y-auto px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (long && !sending) void send()
          }}
        >
          <div className="grid gap-1">
            <Text size="sm" bold>
              What is it about?
            </Text>
            <Select aria-label="What is it about?" className="w-full" value={draft.kind} onValueChange={(v) => set('kind', v as FeedbackKind)} items={FEEDBACK_KIND_LABEL} />
          </div>
          {draft.kind === 'data' && (
            <Text size="sm" variant="secondary">
              Roadbeat shows official information as it's published. If a road event is wrong, Transport and Main Roads can correct it on 13 19 40; for a timetable,
              Translink on 13 12 30. Tell Roadbeat if it shows something differently from the source.
            </Text>
          )}
          <Textarea
            label="Message"
            placeholder={draft.kind === 'bug' ? 'What happened, and what did you expect?' : draft.kind === 'idea' ? 'What would you like Roadbeat to do?' : 'Your message'}
            value={draft.message}
            onChange={(e) => set('message', e.target.value)}
            rows={5}
            maxLength={2000}
            required
          />
          <Input
            label="Email (optional)"
            description="Only if you'd like a reply. It's kept with your message and not used for anything else."
            type="email"
            autoComplete="email"
            value={draft.contact}
            onChange={(e) => set('contact', e.target.value)}
            maxLength={200}
          />
          {/* Hidden from people and screen readers; bots that fill every field fill this too. */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-px opacity-0" value={draft.website} onChange={(e) => set('website', e.target.value)} />
          <Text size="xs" variant="secondary">
            Roadbeat keeps your message, the page you were on and when you sent it. Not your address or browser. See the{' '}
            <a href="/privacy/" className="text-kumo-link underline decoration-1 underline-offset-2">
              privacy page
            </a>
            . In an emergency, call Triple Zero (000).
          </Text>
          {error && (
            <Text size="sm" variant="error" role="alert">
              {error}
            </Text>
          )}
        </form>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-kumo-line px-5 py-3">
        {sent ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="feedback-form" loading={sending} disabled={!long} title={long ? undefined : 'Write at least a sentence'}>
              Send
            </Button>
          </>
        )}
      </div>
    </>
  )
}
