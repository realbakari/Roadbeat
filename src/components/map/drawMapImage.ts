import type * as maplibregl from 'maplibre-gl'
import { iconUrl } from '../../lib/mapIcons'
import type { KeySection } from '../../lib/mapKey'
import { wrapText, type ImageFooter } from '../../lib/mapImage'

// Draws the map and a footer (title, save time, data times, key, credits and
// what's left out) into one PNG. The map's WebGL canvas is cleared after each
// frame, so it's copied inside a 'render' event, while its pixels are still
// there. Every map source must allow CORS, or the browser refuses the copy;
// the one that doesn't (the rain radar) is a separate <img>, left out and said so.

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/** The map's canvas as an image, taken in the next frame it draws. */
function grabMap(map: maplibregl.Map): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    map.once('render', () => {
      const src = map.getCanvas()
      const copy = document.createElement('canvas')
      copy.width = src.width
      copy.height = src.height
      copy.getContext('2d')!.drawImage(src, 0, 0)
      resolve(copy)
    })
    map.triggerRepaint()
  })
}

const loadIcon = (id: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = iconUrl(id)
  })

/** The finished PNG: the map above, the footer below, at the screen's pixel density. */
export async function drawMapImage(map: maplibregl.Map, footer: ImageFooter, key: KeySection[]): Promise<Blob> {
  const shot = await grabMap(map)
  const dpr = shot.width / map.getCanvas().clientWidth || 1
  const w = shot.width
  const pad = 16 * dpr
  const line = 17 * dpr
  const measureCtx = document.createElement('canvas').getContext('2d')!
  const font = (size: number, weight = 400) => `${weight} ${size * dpr}px ${FONT}`
  const wrap = (text: string, size: number, weight = 400) => {
    measureCtx.font = font(size, weight)
    return wrapText(text, w - 2 * pad, (s) => measureCtx.measureText(s).width)
  }

  // Key: icon or dot with its label, in columns of about 220 px.
  const items = key.flatMap((s) => s.items)
  const colW = 220 * dpr
  const cols = Math.max(1, Math.floor((w - 2 * pad) / colW))
  const keyRows = Math.ceil(items.length / cols)
  const icons = await Promise.all(items.map((i) => ('icon' in i ? loadIcon(i.icon).catch(() => null) : Promise.resolve(null))))

  const text = [
    ...wrap(footer.saved, 13),
    ...footer.sources.flatMap((s) => wrap(s, 13)),
    ...footer.missing.flatMap((s) => wrap(s, 13)),
  ]
  const credits = wrap(footer.credits, 11)
  const footerH = pad + 22 * dpr + text.length * line + (items.length ? 8 * dpr + keyRows * 22 * dpr : 0) + 8 * dpr + credits.length * 15 * dpr + pad

  const out = document.createElement('canvas')
  out.width = w
  out.height = shot.height + footerH
  const ctx = out.getContext('2d')!
  ctx.drawImage(shot, 0, 0)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, shot.height, w, footerH)
  ctx.fillStyle = '#e5e7eb'
  ctx.fillRect(0, shot.height, w, 1 * dpr)

  let y = shot.height + pad
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#7a1f3d'
  ctx.font = font(16, 600)
  ctx.fillText(footer.title, pad, y)
  y += 22 * dpr
  ctx.fillStyle = '#1f2937'
  ctx.font = font(13)
  for (const t of text) {
    ctx.fillText(t, pad, y)
    y += line
  }
  if (items.length) {
    y += 8 * dpr
    items.forEach((item, i) => {
      const x = pad + (i % cols) * colW
      const iy = y + Math.floor(i / cols) * 22 * dpr
      const img = icons[i]
      if (img) ctx.drawImage(img, x, iy, 18 * dpr, 18 * dpr)
      else if ('color' in item) {
        ctx.fillStyle = item.color
        ctx.beginPath()
        ctx.arc(x + 9 * dpr, iy + 9 * dpr, 6 * dpr, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#1f2937'
      ctx.font = font(12)
      ctx.fillText(item.label, x + 24 * dpr, iy + 3 * dpr, colW - 28 * dpr)
    })
    y += keyRows * 22 * dpr
  }
  y += 8 * dpr
  ctx.fillStyle = '#6b7280'
  ctx.font = font(11)
  for (const c of credits) {
    ctx.fillText(c, pad, y)
    y += 15 * dpr
  }
  return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('The browser could not make the image'))), 'image/png'))
}
