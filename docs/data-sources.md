# Data sources

Every source the app reads, where it comes from, how the app gets it, and how often it changes. All sources are licensed CC BY 4.0 unless the table says otherwise.

## Live feeds

The browser reads these while the app is open.

| Source | Publisher | URL | How the app reads it | App refresh | Code |
| --- | --- | --- | --- | --- | --- |
| Road events | Transport and Main Roads (TMR) | `data.qldtraffic.qld.gov.au/events_v2.geojson` | Direct | 60 s | `src/api/client.ts` |
| Traffic and flood cameras | TMR | `data.qldtraffic.qld.gov.au/webcameras.geojson`, `floodcameras.geojson` | Direct | 5 min | `src/api/client.ts` |
| Rest areas, RV dump points, truck restrictions | TMR | `data.qldtraffic.qld.gov.au/QLD_RA_LITE.geojson`, `rvEffluentDumpSites.geojson`, `restrictedtruck.geojson` | Direct | Once per visit | `src/api/client.ts` |
| Waze crash reports | TMR (QLDTraffic) | `data.qldtraffic.qld.gov.au/displayed_waze_events.json` | Direct | 60 s | `src/api/client.ts` |
| TMR districts | TMR | `data.qldtraffic.qld.gov.au/districts.geojson` | Direct | Once per visit | `src/api/client.ts` |
| Rain radar | Bureau of Meteorology via QLDTraffic | `rainradar.qldtraffic.qld.gov.au/radarimage` | Direct, as an image | 5 min, and on every map move | `src/components/map/RainRadar.tsx` |
| TransLink network status and notices | Translink | `data.qldtraffic.qld.gov.au/translink/*.json` | Direct | 2 min | `src/api/client.ts` |
| Vehicle positions | Translink | `gtfsrt.api.translink.com.au/api/realtime/{SEQ,CNS}/VehiclePositions` | Proxy `/translink-rt` (protobuf) | 15 s | `src/api/translink.ts` |
| Trip updates | Translink | `gtfsrt.api.translink.com.au/api/realtime/{SEQ,CNS}/TripUpdates` | Proxy `/translink-rt` (protobuf) | 30 s | `src/api/translink.ts` |
| Service alerts | Translink | `gtfsrt.api.translink.com.au/api/realtime/{SEQ,CNS}/alerts` | Proxy `/translink-rt` (protobuf) | 60 s | `src/api/translink.ts` |
| Bushfire warnings and incidents | Queensland Fire Department | `publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com/content/Feeds/BushfireCurrentIncidents/bushfireAlert.json` | Proxy `/qfd-bushfires` | 2 min | `src/api/bushfires.ts` |
| Stream height and rain gauges | Brisbane City Council | `data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/telemetry-sensors-rainfall-and-stream-heights/exports/csv` (last 24 hours) and `…-metadata/exports/json` (gauge list) | Direct | 5 min, while the layer or a flooding event is open | `src/api/bccGauges.ts` |
| Intersection volumes | Brisbane City Council | `data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/traffic-data-at-intersection/exports/csv` | Direct | 2 min, while the layer is on. The council publishes a new batch about every 5 minutes. | `src/api/bccSignals.ts` |
| Crash history | TMR, data.qld.gov.au | `www.data.qld.gov.au/api/3/action/datastore_search_sql` | Direct (CKAN SQL) | On demand | `src/api/crashes.ts` |
| Base maps | OpenFreeMap | `tiles.openfreemap.org/styles/{positron,dark,liberty,bright,fiord}` | Direct | On demand | `src/components/TrafficMap.tsx` |

Base maps are © OpenFreeMap, OpenMapTiles and OpenStreetMap contributors (ODbL for the map data).

Two Brisbane City Council feeds need care:

- **Gauges** report at irregular intervals. Tidal gauges report every few minutes, but some creek gauges report only every few hours. The app shows when each reading was taken and draws a trend only between two real readings. The feed has no flood thresholds, so the app never labels a height as minor, moderate or major flooding.
- **Intersection volumes** give each lane's degree of saturation (`dsN`, measured) and vehicle count (`mfN`, measured). They also give `rfN`, a flow that SCATS calculates. The app does not use `rfN`, because it is an estimate. The council does not publish which street each SCATS approach belongs to.

The QLDTraffic files are the feeds behind qldtraffic.qld.gov.au. They are not part of the published QLDTraffic API specification, so they can change without notice. The documented API at `api.qldtraffic.qld.gov.au` has the same events, but its camera endpoints send no CORS headers. Set `VITE_QLDTRAFFIC_DATA_BASE` to read the files from a mirror.

## Published data built into the app

The `scripts/` build these files from published data. They change when TransLink publishes a new timetable, about every few weeks. See [Refresh the published data](refresh-data.md).

| File | Built from | Script | Size |
| --- | --- | --- | --- |
| `src/data/translink-routes.json` | TransLink GTFS `routes.txt` (SEQ, Cairns) and the Train T Code Route Mapping (data.qld.gov.au) | `npm run data:routes` | Bundled |
| `src/data/translink-stops.json` | GTFS `stops.txt` and `stop_times.txt`: train, tram and ferry stops | `npm run data:stops` | 12 KB compressed |
| `src/data/translink-stops-bus.json` | The same, for every other stop | `npm run data:stops` | 240 KB compressed, loaded on demand |
| `src/data/translink-trips.json` | GTFS `trips.txt`: headsign and direction per trip | `npm run data:stops` | 78 KB compressed, loaded on demand |
| `public/timetables/<region>/<route>.json` | GTFS `stop_times.txt`, `trips.txt`, `calendar.txt`, `calendar_dates.txt` | `npm run data:timetables` | 1.1 MB compressed in total, loaded per route |
| `public/timetables/index.json` | The same: routes per stop and the calendar window | `npm run data:timetables` | 53 KB compressed |
| `public/transit-tracks.json` | GTFS `shapes.txt` for train, tram and ferry routes | `npm run data:tracks` | 74 KB compressed |
| `src/data/translink-maps.json` | The list of PDFs on translink.com.au/plan-your-journey/maps | `npm run data:maps` | Bundled |
| `src/data/bcc-intersections.json` | Brisbane City Council's *Traffic Management — Intersection locations — reference*: each signal's SCATS number, suburb, position and street names | `npm run data:intersections` | 24 KB compressed, loaded on demand |

TransLink's GTFS files are at `gtfsrt.api.translink.com.au/GTFS/SEQ_GTFS.zip` and `CNS_GTFS.zip`.

## Environment variables

All are optional. Each overrides where the app reads one source.

| Variable | Default | Overrides |
| --- | --- | --- |
| `VITE_QLDTRAFFIC_DATA_BASE` | `https://data.qldtraffic.qld.gov.au` | The QLDTraffic feed host |
| `VITE_TRANSLINK_RT_BASE` | `/translink-rt` | The TransLink GTFS-RT proxy path |
| `VITE_QFD_BUSHFIRES_URL` | `/qfd-bushfires` | The bushfire feed proxy path |
