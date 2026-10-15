import { Button, Empty, Popover, Text } from '@cloudflare/kumo'
import { FlameIcon,
  BellIcon,
  BellRingingIcon,
  CheckCircleIcon,
  GearSixIcon,
  InfoIcon,
  NewspaperIcon,
  TrainIcon,
  WarningCircleIcon,
  WarningIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useState } from 'react'
import type { AppNotification } from '../hooks/useNotifications'
import { timeAgo } from '../lib/format'

interface Props {
  items: AppNotification[]
  unread: number
  now: number
  onOpen: (n: AppNotification) => void
  onMarkAllRead: () => void
  onClear: () => void
  onSettings: () => void
}

const TONE: Record<AppNotification['tone'], { icon: Icon; className: string }> = {
  error: { icon: WarningCircleIcon, className: 'text-kumo-danger' },
  warning: { icon: WarningIcon, className: 'text-kumo-warning' },
  info: { icon: InfoIcon, className: 'text-kumo-info' },
  success: { icon: CheckCircleIcon, className: 'text-kumo-success' },
}

/** Bell button in the header with the list of recent alerts. */
export function NotificationCenter({ items, unread, now, onOpen, onMarkAllRead, onClear, onSettings }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <Button
            variant="ghost"
            shape="square"
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            icon={unread ? <BellRingingIcon weight="fill" /> : <BellIcon />}
            className="relative"
          >
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-kumo-danger px-1 text-[10px] font-semibold text-white tabular-nums">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Button>
        }
      />
      <Popover.Content className="w-[min(380px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between border-b border-kumo-line py-2 pr-1.5 pl-3">
          <Popover.Title className="text-base font-semibold">Notifications</Popover.Title>
          <div className="flex items-center gap-0.5">
            {unread > 0 && (
              <Button size="xs" variant="ghost" onClick={onMarkAllRead}>
                Mark all read
              </Button>
            )}
            <Button
              size="xs"
              variant="ghost"
              shape="square"
              aria-label="Notification settings"
              icon={<GearSixIcon />}
              onClick={() => {
                setOpen(false)
                onSettings()
              }}
            />
          </div>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-8">
            <Empty
              size="sm"
              icon={<BellIcon size={32} className="text-kumo-inactive" />}
              title="No alerts yet"
              description="You'll be alerted here about new crashes, closures and red alerts, plus anything you watch."
              contents={
                <Button
                  size="sm"
                  onClick={() => {
                    setOpen(false)
                    onSettings()
                  }}
                >
                  Choose what to watch
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <ul className="max-h-[60vh] divide-y divide-kumo-line overflow-y-auto">
              {items.map((n) => {
                const t = n.kind === 'transit' ? { icon: TrainIcon, className: 'text-kumo-info' } : n.kind === 'fire' ? { icon: FlameIcon, className: TONE[n.tone].className } : n.kind === 'news' ? { icon: NewspaperIcon, className: TONE[n.tone].className } : TONE[n.tone]
                const I = t.icon
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        onOpen(n)
                      }}
                      className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-kumo-tint ${n.read ? '' : 'bg-kumo-tint/50'}`}
                    >
                      <span className={`flex h-lh items-center ${t.className}`}>
                        <I size={16} weight="fill" />
                      </span>
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="flex items-start justify-between gap-2">
                          <Text size="sm" bold={!n.read}>
                            {n.title}
                          </Text>
                          {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-kumo-brand" aria-label="Unread" />}
                        </span>
                        {n.body && (
                          <span className="line-clamp-2 text-xs text-kumo-subtle">{n.body}</span>
                        )}
                        <span className="text-xs text-kumo-subtle">
                          {n.away ? 'While you were away · ' : ''}
                          {timeAgo(n.at, now)}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="flex justify-end border-t border-kumo-line px-2 py-1.5">
              <Button size="xs" variant="ghost" onClick={onClear}>
                Clear all
              </Button>
            </div>
          </>
        )}
      </Popover.Content>
    </Popover>
  )
}
