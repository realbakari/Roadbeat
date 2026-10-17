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
  /** Queensland's severe weather, flood and cyclone warnings, from Queensland Disaster Management. */
  warnings: boolean
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
  /** News monitor stories and official notices that name a Queensland place. */
  news: boolean
  /** Evacuation centres, places of refuge and sandbag points that councils list on their disaster dashboards. */
  councilCentres: boolean
  /** Energex power outages and council notices (water works, fuel supply) from the council disaster dashboards. */
  outages: boolean
  /** The state's air quality monitoring stations, coloured by the department's worst rating at each. */
  airQuality: boolean
  /** Geoscience Australia's satellite hotspots: heat a satellite detected in the last 24 hours. */
  hotspots: boolean
  /** One satellite image: Himawari-9's live image, or NASA's daily true-colour image for one chosen day. */
  satellite: boolean
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
  warnings: true,
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
  news: false,
  councilCentres: true,
  outages: true,
  airQuality: false,
  hotspots: false,
  satellite: false,
}
