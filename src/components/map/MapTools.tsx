import { Button, Text } from '@cloudflare/kumo'
import { CrosshairIcon, DownloadSimpleIcon, NavigationArrowIcon } from '@phosphor-icons/react'
import type * as maplibregl from 'maplibre-gl'
import { useEffect, useState } from 'react'
import { imageFileName, imageFooter } from '../../lib/mapImage'
import { mapKeySections } from '../../lib/mapKey'
import { crosshairItems, formatPosition, type CrosshairItem } from '../../lib/crosshair'
import { drawMapImage } from './drawMapImage'
import type { MapLayers } from './settings'

interface Props {
  map: maplibregl.Map | null
  layers: MapLayers
  /** One line per shown source with its data time, for the saved image's footer. */
  sources: string[]
  /** Layers whose features the crosshair reads (the map's clickable layers). */
  readable: string[]
  /** Finds the user; the map then flies to them and marks where they are. */
  onLocate: () => void
  locating: boolean
  /** Whether the map already shows where the user is. */
  located: boolean
}

/** "My location", "Save image" and the crosshair, under the zoom buttons. */
export function MapTools({ map, layers, sources, readable, onLocate, locating, located }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [crosshair, setCrosshair] = useState(false)

  const save = async () => {
    if (!map) return
    setSaving(true)
    setError(null)
    try {
      const credits = map.getContainer().querySelector('.maplibregl-ctrl-attrib-inner')?.textContent ?? ''
      const footer = imageFooter({ now: Date.now(), siteUrl: location.origin, sources, credits, radar: layers.radar, cameraThumbs: !!map.getContainer().querySelector('.maplibregl-marker img') })
      const blob = await drawMapImage(map, footer, mapKeySections(layers))
      const name = imageFileName(Date.now())
      const file = new File([blob], name, { type: 'image/png' })
      // On phones, the share sheet saves to Photos or sends it on; elsewhere, a download.
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Roadbeat map' }).catch(() => {})
      else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = name
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="absolute top-24 right-2.5 z-10 grid gap-1.5">
        <Button
          size="sm"
          shape="square"
          icon={<NavigationArrowIcon weight={located ? 'fill' : 'regular'} />}
          aria-label="Show my location"
          title="Show my location"
          loading={locating}
          onClick={onLocate}
          className="shadow-md"
        />
        <Button size="sm" shape="square" icon={<DownloadSimpleIcon />} aria-label="Share or save an image of the map" title="Share or save an image of the map, with its sources" loading={saving} onClick={save} className="shadow-md" />
        <Button size="sm" shape="square" variant={crosshair ? 'primary' : 'secondary'} icon={<CrosshairIcon />} aria-label="Crosshair" aria-pressed={crosshair} title="Crosshair: what's at the centre of the map" onClick={() => setCrosshair((v) => !v)} className="shadow-md" />
      </div>
      {error && (
        <div role="alert" className="absolute top-24 right-14 z-10 max-w-60 rounded-md bg-kumo-base px-3 py-2 text-xs shadow-md ring ring-kumo-line">
          Couldn't save the image: {error}.
        </div>
      )}
      {crosshair && map && <Crosshair map={map} readable={readable} />}
    </>
  )
}

/** The map centre's coordinates and the official items drawn under it. */
function readCrosshair(map: maplibregl.Map, readable: string[]) {
  const c = map.getCenter()
  const p = map.project(c)
  const layers = readable.filter((l) => map.getLayer(l))
  const fs = layers.length ? map.queryRenderedFeatures([[p.x - 8, p.y - 8], [p.x + 8, p.y + 8]], { layers }) : []
  return { position: [c.lng, c.lat] as [number, number], items: crosshairItems(fs.map((f) => ({ label: f.properties?.label, key: f.properties?.key }))) }
}

/** A crosshair at the map's centre, with its coordinates and the official items drawn under it. */
function Crosshair({ map, readable }: { map: maplibregl.Map; readable: string[] }) {
  const [state, setState] = useState(() => readCrosshair(map, readable))
  useEffect(() => {
    const update = () => setState(readCrosshair(map, readable))
    map.on('moveend', update)
    map.on('idle', update)
    return () => {
      map.off('moveend', update)
      map.off('idle', update)
    }
  }, [map, readable])
  return (
    <>
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2" aria-hidden>
        <svg width="36" height="36" viewBox="0 0 36 36">
          <g stroke="#000" strokeOpacity="0.6" strokeWidth="4">
            <path d="M18 2v12M18 22v12M2 18h12M22 18h12" />
          </g>
          <g stroke="#fff" strokeWidth="2">
            <path d="M18 2v12M18 22v12M2 18h12M22 18h12" />
          </g>
        </svg>
      </div>
      <div role="status" aria-live="polite" className="absolute top-3 right-14 z-10 grid max-w-64 gap-1 rounded-lg bg-kumo-base px-3 py-2 text-sm shadow-md ring ring-kumo-line">
        <span className="tabular-nums">{formatPosition(state.position)}</span>
        {state.items.length ? (
          <ul className="grid gap-0.5 text-xs">
            {state.items.map((i: CrosshairItem) => (
              <li key={i.key ?? i.label}>{i.label}</li>
            ))}
          </ul>
        ) : (
          <Text size="xs" variant="secondary">
            Nothing from the layers that are on, under the centre.
          </Text>
        )}
      </div>
    </>
  )
}
