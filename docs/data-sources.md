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
| Rain radar | Bureau of Meteorology via QLDTraffic | `rainradar.qldtraffic.qld.gov.au/radarimage` | Direct, as an image pinned to the area it covers, which moves with the map. Each image covers 30% more than the view on every side. | 5 min, and when the view leaves the covered area or the zoom changes | `src/components/map/RainRadar.tsx` |
| TransLink network status and notices | Translink | `data.qldtraffic.qld.gov.au/translink/*.json` | Direct | 2 min | `src/api/client.ts` |
| Vehicle positions | Translink | `gtfsrt.api.translink.com.au/api/realtime/{SEQ,CNS}/VehiclePositions` | Proxy `/translink-rt` (protobuf) | 15 s | `src/api/translink.ts` |
| Trip updates | Translink | `gtfsrt.api.translink.com.au/api/realtime/{SEQ,CNS}/TripUpdates` | Proxy `/translink-rt` (protobuf) | 30 s | `src/api/translink.ts` |
| Service alerts | Translink | `gtfsrt.api.translink.com.au/api/realtime/{SEQ,CNS}/alerts` | Proxy `/translink-rt` (protobuf) | 60 s | `src/api/translink.ts` |
| Bushfire warnings and incidents | Queensland Fire Department | `publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com/content/Feeds/BushfireCurrentIncidents/bushfireAlert.json` | Proxy `/qfd-bushfires` | 2 min | `src/api/bushfires.ts` |
| Stream height and rain gauges | Brisbane City Council | `data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/telemetry-sensors-rainfall-and-stream-heights/exports/csv` (last 24 hours) and `…-metadata/exports/json` (gauge list) | Direct | 5 min, while the layer or a flooding event is open | `src/api/bccGauges.ts` |
| Statewide stream gauges | Department of Local Government, Water and Volunteers (Water Monitoring Information Portal) | `water-monitoring.information.qld.gov.au/cgi/webservice.pl`, `get_latest_ts_values` for datasource `AT`, variable 100 (stream water level), POSTed for every station in `public/qld-gauges.json` | Proxy `/qld-gauges` (`api/qld-gauges.ts`, `functions/qld-gauges.ts`, dev plugin in `vite.config.ts`), cached 5 min at the edge | 5 min, while the layer, a gauge page or a flooding event is open | `src/api/qldGauges.ts`, `src/api/qldGaugesFeed.ts` |
| Intersection volumes | Brisbane City Council | `data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/traffic-data-at-intersection/exports/csv` | Direct | 2 min, while the layer is on. The council publishes a new batch about every 5 minutes. | `src/api/bccSignals.ts` |
| Railway station facilities and access | Queensland Rail, published by Brisbane City Council | `data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/railway-station-facilities/records?where=stops="<stop id>"` | Direct | Once per station per visit | `src/api/stationFacilities.ts` |
| Planned road occupancies | Brisbane City Council | `data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/planned-temporary-road-occupancies/exports/json` | Direct. The permit holder's contact details are dropped. | 30 min, while Road events is open. The council updates daily. | `src/api/bccRoadOccupancies.ts` |
| CBD car park spaces | Brisbane City Council | `data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/brisbane-parking-stations/records` | Direct | 5 min, on the dashboard | `src/api/bccParking.ts` |
| Low clearances | Brisbane City Council; Queensland Rail, published by Brisbane City Council | `data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/road-restrictions/exports/json`, `…/road-restrictions-qr/exports/json` and `…/road-restrictions-qr` (dataset metadata) | Direct | Once per visit, when the layer or a clearance page is opened. Both datasets update about monthly. | `src/api/clearances.ts` |
| Clearways | Brisbane City Council | `data.brisbane.qld.gov.au/…/datasets/parking-clearways/exports/json` | Direct. `src/lib/clearways.ts` reads the signed times; times it can't read are shown as published, with no in-effect claim. | Once per visit, while the layer or a clearway page is open | `src/api/bccPlaces.ts` |
| Public toilets | National Public Toilet Map, published by Brisbane City Council | `data.brisbane.qld.gov.au/…/datasets/public-toilets-in-brisbane/exports/json` | Direct | Once per visit, while the layer is on | `src/api/bccPlaces.ts` |
| Accessible parking | Brisbane City Council | `data.brisbane.qld.gov.au/…/datasets/disability-permit-parking-locations/exports/json` | Direct. Signs no longer in service are dropped. | Once per visit, while the layer is on | `src/api/bccPlaces.ts` |
| Parking meters | Brisbane City Council | `…/datasets/brisbane-parking-meters/exports/json` | Direct | Once per visit, while the layer is on | `src/api/bccPlaces.ts` |
| Bike racks and repair stations | Brisbane City Council | `…/datasets/bicycle-racks/exports/json`, `…/bike-repair-stations/exports/json` | Direct | Once per visit, while the cycling layer is on | `src/api/bccPlaces.ts` |
| Bus stop audit | Brisbane City Council | `data.brisbane.qld.gov.au/…/datasets/brisbane-bus-stops/records?where=hastus="<stop id>"` | Direct. `hastus` is TransLink's stop id. | Once per stop per visit | `src/api/bccBusStops.ts` |
| Ferry terminal access | Brisbane City Council | `data.brisbane.qld.gov.au/…/datasets/ferry-terminals/records?where=hastus="<stop id>"` | Direct. `hastus` is TransLink's stop id. | Once per terminal per visit | `src/api/ferryTerminals.ts` |
| Key corridor performance | Brisbane City Council | `…/datasets/traffic-management-key-corridor-monthly-performance-report/exports/json?where=year in (…)` and `…-routes/exports/json` | Direct | 6 h, on the dashboard. The council publishes monthly. | `src/api/bccDashboard.ts` |
| Council events | Brisbane City Council | `…/datasets/brisbane-city-council-events/exports/json` (today and tomorrow for the dashboard; today and the next 7 days, including ongoing exhibitions, for the map layer) | Direct. The dashboard leaves out all-day listings, which start at midnight. The map shows only events with a published location, with the council's details and its event image (a JPG on trumba.com), and identifies each by Trumba's event id in the council's link. HTML in the council's text is reduced to plain text. | 15 min on the dashboard; once per visit while the map layer or an event page is open | `src/api/bccDashboard.ts` |
| Pedestrian movements | Brisbane City Council | `…/datasets/pedestrian-movement-counts/exports/json?where=date = date'<yesterday>'` | Direct. Estimated hours (`is_computed`) and counts published as "< 25" are left out. | 1 h, on the dashboard. The council publishes the previous day. | `src/api/bccDashboard.ts` |
| Crash history | TMR, data.qld.gov.au | `www.data.qld.gov.au/api/3/action/datastore_search_sql` | Direct (CKAN SQL) | On demand | `src/api/crashes.ts` |
| Base maps | OpenFreeMap | `tiles.openfreemap.org/styles/{positron,dark,liberty,bright,fiord}` | Direct | On demand | `src/components/TrafficMap.tsx` |

Base maps are © OpenFreeMap, OpenMapTiles and OpenStreetMap contributors (ODbL for the map data).

Three Brisbane City Council feeds need care:

- **Gauges** report at irregular intervals. Tidal gauges report every few minutes, but some creek gauges report only every few hours. The app shows when each reading was taken and draws a trend only between two real readings. The feed has no flood thresholds, so the app never labels a height as minor, moderate or major flooding.
- **Statewide stream gauges** differ from the council's. The portal's web service gives the latest reading only, so a state gauge page shows one height with its time and no trend. Heights are gauge heights on each station's own datum, not AHD. Times are AEST. Readings older than 24 hours, and values whose quality code says they were estimated or derived (50, 59, 60, 69, 136, 151 in the department's quality code list), are left out. The service answers in about 20 seconds for the whole network and rejects long GET URLs, which is why the proxy POSTs and caches for 5 minutes.
- **Low clearances** come from two datasets. The council's rows each have a `validation_date`; the app shows it as "Validated". Queensland Rail's rows have no date or id: the app dates them by the dataset's "temporal coverage from" metadata, the day Queensland Rail's extract was taken, and identifies each bridge by its published latitude and longitude. The app shows `signed_clearance_min` and `road_clearance_m` exactly as published, never rounded. It ignores `signed_clearance_max`, which holds the placeholders 9999 and -9999.
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
| `public/flood-2022.json` | Brisbane City Council *Flood Awareness: Historic Brisbane River and Creek Floods Feb 2022*: the adopted extent, outlines simplified to about 5 m (771,544 points to about 115,000) | `npm run data:flood2022` | 0.5 MB compressed, loaded when the layer is turned on |
| `public/bikeways.json` | Brisbane City Council *Bikeway sections*: about 8,000 sections with their type, hierarchy and street, lines simplified to about 3 m | `npm run data:bikeways` | 0.24 MB compressed, loaded when the cycling layer is turned on |
| `public/qld-gauges.json` | Department of Local Government, Water and Volunteers *Queensland Water Monitoring Hydrology Data* (data.qld.gov.au, CC BY 4.0), the stream gauging station network list: each open station's id, name and position, kept if the portal's web service has a telemetered stream height for it | `npm run data:qld-gauges` | 9 KB compressed, loaded when the gauges layer is turned on |
| `src/data/gauge-catchments.json` | Bureau of Meteorology *National Flood Gauge Network* (data.gov.au, CC BY 4.0): the flood warning catchment each Brisbane stream gauge is in, and its BoM product id | `npm run data:catchments` | Bundled |
| `src/data/bcc-intersections.json` | Brisbane City Council's *Traffic Management — Intersection locations — reference*: each signal's SCATS number, suburb, position and street names | `npm run data:intersections` | 24 KB compressed, loaded on demand |

TransLink's GTFS files are at `gtfsrt.api.translink.com.au/GTFS/SEQ_GTFS.zip` and `CNS_GTFS.zip`.

## Environment variables

All are optional. Each overrides where the app reads one source.

| Variable | Default | Overrides |
| --- | --- | --- |
| `VITE_QLDTRAFFIC_DATA_BASE` | `https://data.qldtraffic.qld.gov.au` | The QLDTraffic feed host |
| `VITE_TRANSLINK_RT_BASE` | `/translink-rt` | The TransLink GTFS-RT proxy path |
| `VITE_QLD_GAUGES_URL` | `/qld-gauges` | The statewide stream gauges proxy path |
| `VITE_QFD_BUSHFIRES_URL` | `/qfd-bushfires` | The bushfire feed proxy path |

## What the app links to instead of showing

The Bureau of Meteorology's flood warnings, and the minor, moderate and major flood levels for its gauges, are published under BoM's default terms: personal use only, not to be supplied to anyone else. Its web API says it must not be used. So the app doesn't show warning text or flood levels. A gauge page links to the BoM warning page for the gauge's catchment, using the catchment's product id from the CC BY *National Flood Gauge Network*.

TransLink reports lift and escalator outages as service alerts with the GTFS-RT effect `ACCESSIBILITY_ISSUE`, naming the stops they affect. Stop pages and the dashboard show them as published.
