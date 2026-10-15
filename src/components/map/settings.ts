/** OpenFreeMap base maps. "standard" follows the app's light/dark theme. */
export type Basemap = 'standard' | 'detailed' | 'bright' | 'night'

export interface MapLayers {
  webcams: boolean
  floodcams: boolean
  restAreas: boolean
  dumpPoints: boolean
  trucks: boolean
  waze: boolean
  radar: boolean
  crashes: boolean
  vehicles: boolean
  /** OpenStreetMap building heights, with the map tilted to show them. */
  buildings3d: boolean
  /** Queensland Fire Department bushfire warnings and incidents. */
  fires: boolean
  /** Brisbane City Council stream height and rain gauges. */
  gauges: boolean
  /** Brisbane City Council signalised intersections, coloured by measured saturation. */
  signals: boolean
  /** Brisbane City Council and Queensland Rail low clearance bridges and structures. */
  clearances: boolean
}

export const DEFAULT_LAYERS: MapLayers = {
  webcams: true,
  floodcams: true,
  restAreas: false,
  dumpPoints: false,
  trucks: false,
  waze: false,
  radar: false,
  crashes: false,
  vehicles: false,
  buildings3d: false,
  fires: true,
  gauges: false,
  signals: false,
  clearances: false,
}
