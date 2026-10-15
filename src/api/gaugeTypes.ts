// Gauge types shared by the council and state gauge modules, with no imports so
// the server functions can read them too (see api/qld-gauges.ts).

export interface GaugeReading {
  /** When the gauge measured it (ms). */
  time: number
  value: number
}

export interface Gauge {
  /** Sensor id, e.g. "E1594". */
  id: string
  name: string
  /** Stream height in metres (council gauges: above the Australian Height Datum; state gauges: on the station's own datum), or rainfall in mm per 5 minutes. */
  kind: 'stream' | 'rain'
  /** Brisbane City Council (24 hours of readings) or the Queensland water monitoring portal (the latest reading only, see qldGaugesFeed.ts). */
  source: 'bcc' | 'qld'
  unit: string
  position: [lng: number, lat: number]
  /** Readings over the last 24 hours, oldest first. Intervals with no report are left out. */
  readings: GaugeReading[]
}
