import { Badge, Button } from '@cloudflare/kumo'
import { ArrowLeftIcon, ArrowsClockwiseIcon, MoonIcon, SunIcon } from '@phosphor-icons/react'
import { useEffect, useMemo, type ReactNode } from 'react'
import type { SourceStatus } from '../api/newsTypes'
import { Stat, Tile } from '../dashboard/Tile'
import { useColorMode } from '../hooks/useColorMode'
import { useNow } from '../hooks/useTrafficData'
import { cadenceLabel, groupByPublisher, readLabel, summarise, type FeedOutcome } from '../lib/feedHealth'
import { FEEDS, type Feed } from '../lib/feedRegistry'
import { timeAgo } from '../lib/format'
import { useFeedHealth } from './useFeedHealth'

const clock = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const stamp = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/**
 * Every feed the app reads, with its provenance from the registry and the
 * result of reading it from this browser just now. A feed is "ok" only when
 * the app's own fetch function returned parsed data; until a check runs, or
 * for a feed the page cannot read, it is "not checked".
 */
export function StatusPage() {
  const now = useNow(15_000)
  const { outcomes, checking, lastRound, check } = useFeedHealth()
  const { mode, toggle } = useColorMode()
  const groups = useMemo(() => groupByPublisher(FEEDS), [])
  const counts = summarise(Object.values(outcomes))
  useEffect(() => {
    document.title = `Roadbeat feed status · ${counts.ok} ok, ${counts.failed} failed`
  }, [counts.ok, counts.failed])

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-kumo-canvas p-4 xl:p-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <a href="/" className="flex items-center gap-2" title="Open the full app">
          <img src="/favicon.svg" alt="" className="size-8" />
          <span className="text-lg font-semibold text-kumo-strong">Roadbeat</span>
        </a>
        <h1 className="text-lg text-kumo-subtle">Feed status and provenance</h1>
        <span className="ml-auto flex flex-wrap items-center gap-3 text-sm text-kumo-subtle">
          <span aria-live="polite" className="whitespace-nowrap">{checking ? 'Checking…' : lastRound ? `Checked ${timeAgo(lastRound, now)}` : 'Starting…'}</span>
          <span className="whitespace-nowrap text-base font-medium text-kumo-strong tabular-nums">{clock.format(now)}</span>
          <Button variant="secondary" size="sm" icon={<ArrowsClockwiseIcon />} loading={checking} onClick={() => void check()}>
            Check now
          </Button>
          <a href="/dashboard" className="hover:text-kumo-default hover:underline">
            Dashboard
          </a>
          <Button variant="ghost" shape="square" aria-label="Back to the app" icon={<ArrowLeftIcon />} onClick={() => location.assign('/')} />
          <Button variant="ghost" shape="square" aria-label="Toggle colour mode" icon={mode === 'dark' ? <SunIcon /> : <MoonIcon />} onClick={toggle} />
        </span>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Feeds in the registry" value={FEEDS.length} />
        <Stat label="Answered and parsed" value={counts.ok} tone={counts.ok ? 'var(--color-kumo-success)' : undefined} />
        <Stat label="Failed" value={counts.failed} tone={counts.failed ? 'var(--color-kumo-danger)' : undefined} />
        <Stat label="Not checked" value={counts.unchecked} />
      </div>

      <p className="text-sm text-kumo-subtle">
        Each feed is read from this browser through the same path and parser the app uses, when the page opens and every two minutes after. A result says what this
        browser saw at that moment, nothing more. The list comes from <code className="text-xs">src/lib/feedRegistry.ts</code>; see{' '}
        <a href="https://github.com/realbakari/Roadbeat/blob/main/docs/data-sources.md" className="underline">
          Data sources
        </a>{' '}
        for licences and terms in full.
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((g) => (
          <Tile key={g.publisher} title={g.publisher} className="xl:overflow-visible">
            <ul className="grid gap-2">
              {g.feeds.map((f) => (
                <FeedRow key={f.id} feed={f} outcome={outcomes[f.id]} now={now} />
              ))}
            </ul>
          </Tile>
        ))}
      </div>
    </div>
  )
}

function FeedRow({ feed, outcome, now }: { feed: Feed; outcome: FeedOutcome; now: number }) {
  return (
    <li className="grid gap-1 rounded-md py-2 ring ring-kumo-line px-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-kumo-strong">{feed.name}</span>
        <Outcome outcome={outcome} />
        <span className="ml-auto text-xs text-kumo-subtle tabular-nums">
          {outcome.kind === 'unchecked' ? outcome.reason : `Checked ${timeAgo(outcome.checkedAt, now)}`}
        </span>
      </div>
      {outcome.kind === 'failed' && <p className="text-sm text-kumo-danger">{outcome.error}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-kumo-subtle sm:grid-cols-[auto_1fr_auto_1fr]">
        <Fact label="Reads">{readLabel(feed.read, feed.path)}</Fact>
        <Fact label="Every">
          {feed.refreshSeconds != null ? cadenceLabel(feed.refreshSeconds) : feed.refreshNote}
          {feed.refreshSeconds != null && feed.refreshNote ? ` · ${feed.refreshNote}` : ''}
        </Fact>
        <Fact label="Licence">{feed.licence}</Fact>
        <Fact label={outcome.kind === 'ok' && outcome.publisherTime ? outcome.publisherTime.label : 'Publisher time'}>
          {outcome.kind === 'ok' && outcome.publisherTime ? (
            <span className="tabular-nums" title={new Date(outcome.publisherTime.at).toISOString()}>
              {stamp.format(outcome.publisherTime.at)} ({timeAgo(outcome.publisherTime.at, now)})
            </span>
          ) : outcome.kind === 'ok' ? (
            'The feed carries none'
          ) : (
            '—'
          )}
        </Fact>
        <Fact label="Source" wide>
          <span className="break-all">{feed.url}</span>
          {feed.datasetUrl && (
            <>
              {' · '}
              <a href={feed.datasetUrl} target="_blank" rel="noreferrer" className="underline">
                Dataset page
              </a>
            </>
          )}
        </Fact>
        <Fact label="Shown on" wide>
          {feed.feeds.join(', ')} · <code>{feed.module}</code>
        </Fact>
      </dl>
      {outcome.kind === 'ok' && outcome.sources && <Sources sources={outcome.sources} />}
    </li>
  )
}

function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <>
      <dt className="font-medium">{label}</dt>
      <dd className={`min-w-0 ${wide ? 'sm:col-span-3' : ''}`}>{children}</dd>
    </>
  )
}

function Outcome({ outcome }: { outcome: FeedOutcome }) {
  if (outcome.kind === 'ok') {
    return (
      <Badge variant="success" appearance="dot">
        OK
      </Badge>
    )
  }
  if (outcome.kind === 'failed') {
    return (
      <Badge variant={outcome.needsProxy ? 'warning' : 'error'} appearance="dot">
        {outcome.needsProxy ? 'Needs proxy' : 'Failed'}
      </Badge>
    )
  }
  return (
    <Badge variant="neutral" appearance="dot">
      Not checked
    </Badge>
  )
}

/** The news monitor's own report of each source from its last run on the server. */
function Sources({ sources }: { sources: SourceStatus[] }) {
  return (
    <ul className="mt-1 grid gap-0.5 border-t border-kumo-line pt-2 text-xs sm:grid-cols-2">
      {sources.map((s) => (
        <li key={s.id} className="flex items-baseline gap-2">
          <span className={`mt-1 size-2 shrink-0 self-start rounded-full ${s.ok ? 'bg-kumo-success' : 'bg-kumo-danger'}`} aria-hidden />
          <span className="min-w-0">
            <span className="text-kumo-strong">{s.publisher}</span>
            <span className="text-kumo-subtle">
              {' '}
              · {s.id} · {s.ok ? `${s.count} kept` : 'failed'}
            </span>
            {s.error && <span className="block text-kumo-danger">{s.error}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
