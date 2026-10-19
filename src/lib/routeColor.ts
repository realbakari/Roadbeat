import { contrastRatio, luminance } from './contrast'

/**
 * Text colour that stays readable on a route's official colour. Translink's
 * palette includes light colours (T5 and the G:link are #FFC425) where white
 * text fails contrast, so this picks near-black for light backgrounds.
 */
export function readableTextOn(hex: string): '#ffffff' | '#1d1d1d' {
  if (luminance(hex) == null) return '#ffffff'
  return contrastRatio(hex, '#1d1d1d') > contrastRatio(hex, '#ffffff') ? '#1d1d1d' : '#ffffff'
}
