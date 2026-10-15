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
  /** Brisbane City Council and Queensland Government stream height and rain gauges. */
  gauges: boolean
  /** Brisbane City Council signalised intersections, coloured by measured saturation. */
  signals: boolean
  /** Brisbane City Council and Queensland Rail low clearance bridges and structures. */
  clearances: boolean
  /** Brisbane City Council clearways, coloured by whether their signed times cover now. */
  clearways: boolean
  /** Public toilets in Brisbane, from the National Public Toilet Map via the council. */
  toilets: boolean
  /** Brisbane City Council accessible (disability permit) parking bays. */
  accessibleParking: boolean
  /** Brisbane City Council's adopted extent of the February 2022 flood. */
  flood2022: boolean
  /** Brisbane City Council parking meters, with their hours and rates. */
  parkingMeters: boolean
  /** Brisbane City Council bikeways, bike racks and repair stations. */
  cycling: boolean
  /** Brisbane City Council events on today and the next 7 days. */
  councilEvents: boolean
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
  clearways: false,
  toilets: false,
  accessibleParking: false,
  flood2022: false,
  parkingMeters: false,
  cycling: false,
  councilEvents: false,
}
