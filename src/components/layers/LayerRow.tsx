import { Switch, Text } from '@cloudflare/kumo'
import { useContext, type ReactNode } from 'react'
import { layerInfo } from '../../lib/layerInfo'
import { LayerInfoLine } from '../LayerFacts'
import type { MapLayers } from '../map/settings'
import { LayerTimes } from './layerTimes'

// The pieces each group of layer switches in the map's Layers panel is built from.

/** What every group needs: the layers, their counts, and a way to switch one. */
export interface LayerGroupProps {
  layers: MapLayers
  counts: Partial<Record<keyof MapLayers, number>>
  set: (key: keyof MapLayers, on: boolean) => void
}

/** A titled block of layer switches. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-0.5 border-t border-kumo-line pt-3">
      <Text size="xs" variant="secondary">
        {title}
      </Text>
      {children}
    </section>
  )
}

/** One layer's switch, with its key or settings underneath while it's on. */
export function LayerRow({
  icon,
  label,
  count,
  checked,
  onChange,
  layer,
  children,
}: {
  icon: ReactNode
  label: string
  count?: number
  checked: boolean
  onChange: (on: boolean) => void
  /** The layer's key, for its publisher, cadence and latest time (src/lib/layerInfo.ts). */
  layer?: keyof MapLayers
  children?: ReactNode
}) {
  const times = useContext(LayerTimes)
  const info = layer ? layerInfo(layer) : null
  return (
    <>
      <label className="flex cursor-pointer items-center gap-2 rounded-md py-1 text-sm">
        {icon}
        <span className="flex-1">
          {label}
          {count != null && <span className="ml-1 text-kumo-subtle tabular-nums">{count}</span>}
        </span>
        <Switch size="sm" aria-label={label} checked={checked} onCheckedChange={onChange} />
      </label>
      {checked && (children || info) && (
        <div className="grid gap-1.5 pb-1.5 pl-7">
          {info && <LayerInfoLine info={info} latest={layer && times.latest[layer]} now={times.now} />}
          {children}
        </div>
      )}
    </>
  )
}

/** A small coloured disc holding a layer's icon. */
export function Badge({ icon, color, className = '' }: { icon: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={`flex size-5 shrink-0 items-center justify-center rounded-full text-white ${className}`}
      style={color ? { background: color } : undefined}
    >
      {icon}
    </span>
  )
}

