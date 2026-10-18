import { createContext } from 'react'
import type { DataTime } from '../../lib/layerInfo'
import type { MapLayers } from '../map/settings'

/** Each layer's latest data time, and the clock to age it by, for the rows' info lines. */
export const LayerTimes = createContext<{ latest: Partial<Record<keyof MapLayers, DataTime>>; now: number }>({ latest: {}, now: 0 })
