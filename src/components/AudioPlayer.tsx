import { Button } from '@cloudflare/kumo'
import { PauseIcon, PlayIcon } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { NewTabNote } from './NewTabNote'

const clock = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '–:––')

/**
 * A compact audio player in the app's style: play or pause, a seek bar and the
 * time. Nothing downloads until someone presses play (preload="none").
 */
export function AudioPlayer({ src, label }: { src: string; label: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(NaN)
  const [failed, setFailed] = useState(false)

  const toggle = () => {
    const a = audio.current
    if (!a) return
    if (a.paused) {
      setLoading(a.readyState < 3)
      void a.play().catch(() => setFailed(true))
    } else a.pause()
  }

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-1.5 ring ring-kumo-line">
      <audio
        ref={audio}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onPlaying={() => setLoading(false)}
        onWaiting={() => setLoading(true)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onError={() => setFailed(true)}
      />
      <Button
        variant="secondary"
        shape="square"
        size="sm"
        loading={loading}
        disabled={failed}
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        icon={playing ? <PauseIcon weight="fill" /> : <PlayIcon weight="fill" />}
        onClick={toggle}
      />
      {failed ? (
        <a href={src} target="_blank" rel="noopener noreferrer" className="text-sm text-kumo-link underline decoration-1 underline-offset-2">
          Couldn't play here. Open the recording
          <NewTabNote />
        </a>
      ) : (
        <>
          <input
            type="range"
            min={0}
            max={Number.isFinite(duration) ? duration : 0}
            step={1}
            value={time}
            disabled={!Number.isFinite(duration)}
            aria-label={`Seek ${label}`}
            aria-valuetext={`${clock(time)} of ${clock(duration)}`}
            onChange={(e) => {
              const a = audio.current
              if (a) a.currentTime = Number(e.target.value)
            }}
            className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--color-kumo-brand)] disabled:cursor-default"
          />
          <span className="shrink-0 text-xs text-kumo-subtle tabular-nums">
            {clock(time)} / {clock(duration)}
          </span>
        </>
      )}
    </div>
  )
}
