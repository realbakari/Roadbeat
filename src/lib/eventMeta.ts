import { CalendarDotsIcon, WarningIcon, WavesIcon, type Icon } from '@phosphor-icons/react'
import { CrashIcon, QueueIcon, WorkerIcon } from '../components/icons/roadGlyphs'
import type { EventPriority, EventType } from '../api/types'

type BadgeVariant = 'red' | 'orange' | 'warning' | 'blue' | 'purple' | 'teal'

export interface EventTypeMeta {
  type: EventType
  label: string
  /** Map colour; chosen to read on both light and dark basemaps. */
  color: string
  badge: BadgeVariant
  icon: Icon
}

export const EVENT_TYPES: EventTypeMeta[] = [
  { type: 'Crash', label: 'Crashes', color: '#dc2626', badge: 'red', icon: CrashIcon },
  { type: 'Hazard', label: 'Hazards', color: '#ea580c', badge: 'orange', icon: WarningIcon },
  { type: 'Flooding', label: 'Flooding', color: '#2563eb', badge: 'blue', icon: WavesIcon },
  { type: 'Congestion', label: 'Congestion', color: '#9333ea', badge: 'purple', icon: QueueIcon },
  { type: 'Roadworks', label: 'Roadworks', color: '#ca8a04', badge: 'warning', icon: WorkerIcon },
  { type: 'Special event', label: 'Special events', color: '#0d9488', badge: 'teal', icon: CalendarDotsIcon },
]

const BY_TYPE = new Map(EVENT_TYPES.map((m) => [m.type, m]))

export function typeMeta(type: string): EventTypeMeta {
  return BY_TYPE.get(type as EventType) ?? EVENT_TYPES[1]
}

export const PRIORITIES: EventPriority[] = ['Red Alert', 'High', 'Medium', 'Low']

export function priorityRank(p: string): number {
  const i = PRIORITIES.indexOf(p as EventPriority)
  return i === -1 ? PRIORITIES.length : i
}

export function priorityBadge(p: string): {
  variant: 'error' | 'warning' | 'neutral'
  appearance: 'filled' | 'dot'
} {
  switch (p) {
    case 'Red Alert':
      return { variant: 'error', appearance: 'filled' }
    case 'High':
      return { variant: 'error', appearance: 'dot' }
    case 'Medium':
      return { variant: 'warning', appearance: 'dot' }
    default:
      return { variant: 'neutral', appearance: 'dot' }
  }
}

export const CAMERA_COLOR = { webcam: '#475569', floodcam: '#0891b2' } as const
