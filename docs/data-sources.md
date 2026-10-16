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
| Air quality | Department of Environment, Tourism, Science and Innovation | `apps.des.qld.gov.au/air-quality/xml/feed.php?category=1&region=ALL` | Proxy `/air-quality` (the feed sends no CORS headers). Each station's readings for the hour with the department's own index, rating (1 to 5) and rating name; a reading the feed marks -1111 (offline) or -9999 (no data) is shown as such. Units come from the department's Air Quality Query API (`airquality.des.qld.gov.au/v1/parameters`), which the feed leaves out. | 10 min, while the layer or a station page is open. The feed changes hourly. | `src/api/airQuality.ts` |
| Crash history | TMR, data.qld.gov.au | `www.data.qld.gov.au/api/3/action/datastore_search_sql` | Direct (CKAN SQL) | On demand | `src/api/crashes.ts` |
| Camera image times | The camera hosts (QLDTraffic's and the councils') | `HEAD` on the image address, through `/api/camera-time` | The host's `Last-Modified` header for the pinned camera's image, read once a minute, when the image reloads. Only known camera hosts are asked (`src/api/cameraTime.ts`). Neither QLDTraffic nor the councils publish an update interval; a council's own note on a camera ("Images are typically updated every 10 minutes") is shown when it gives one. | 1 min, while a camera is pinned | `api/camera-time.ts`, `functions/camera-time.ts` |
| Base maps | OpenFreeMap | `tiles.openfreemap.org/styles/{positron,dark,liberty,bright,fiord}` | Direct | On demand | `src/components/TrafficMap.tsx` |

Base maps are © OpenFreeMap, OpenMapTiles and OpenStreetMap contributors (ODbL for the map data).

Three Brisbane City Council feeds need care:

- **Gauges** report at irregular intervals. Tidal gauges report every few minutes, but some creek gauges report only every few hours. The app shows when each reading was taken and draws a trend only between two real readings. The feed has no flood thresholds, so the app never labels a height as minor, moderate or major flooding.
- **Statewide stream gauges** differ from the council's. The portal's web service gives the latest reading only, so a state gauge page shows one height with its time and no trend. Heights are gauge heights on each station's own datum, not AHD. Times are AEST. Readings older than 24 hours, and values whose quality code says they were estimated or derived (50, 59, 60, 69, 136, 151 in the department's quality code list), are left out. The service answers in about 20 seconds for the whole network and rejects long GET URLs, which is why the proxy POSTs and caches for 5 minutes.
- **Low clearances** come from two datasets. The council's rows each have a `validation_date`; the app shows it as "Validated". Queensland Rail's rows have no date or id: the app dates them by the dataset's "temporal coverage from" metadata, the day Queensland Rail's extract was taken, and identifies each bridge by its published latitude and longitude. The app shows `signed_clearance_min` and `road_clearance_m` exactly as published, never rounded. It ignores `signed_clearance_max`, which holds the placeholders 9999 and -9999.
- **Intersection volumes** give each lane's degree of saturation (`dsN`, measured) and vehicle count (`mfN`, measured). They also give `rfN`, a flow that SCATS calculates. The app does not use `rfN`, because it is an estimate. The council does not publish which street each SCATS approach belongs to.

The QLDTraffic files are the feeds behind qldtraffic.qld.gov.au. They are not part of the published QLDTraffic API specification, so they can change without notice. The documented API at `api.qldtraffic.qld.gov.au` has the same events, but its camera endpoints send no CORS headers. Set `VITE_QLDTRAFFIC_DATA_BASE` to read the files from a mirror.

## News monitor feeds

The **News** tab, its map pins and the dashboard's **What's happening** strip come from these feeds. Most send no CORS headers, so the server reads them, not the browser: `api/news-ingest.ts` every 5 minutes, or `api/news.ts` on demand when there is no store or the stored copy is more than 15 minutes old (see [Deploy the app](deploy.md)). The browser polls `/api/news` every 2 minutes while the tab, the map layer, the dashboard or a news alert needs it. `npm run news:ingest` reads every feed once from your own machine and prints what each one gave.

| Source | Publisher | URL | Kind | Kept | Terms |
| --- | --- | --- | --- | --- | --- |
| ABC News Queensland | ABC | `www.abc.net.au/news/feed/50990/rss.xml` | News | All items | [ABC Conditions of Use](https://about.abc.net.au/abc-conditions-of-use/). No RSS-specific licence published. |
| ABC Brisbane | ABC | `www.abc.net.au/news/feed/13787262/rss.xml` | News | All items | As above |
| ABC Just In | ABC | `www.abc.net.au/news/feed/51120/rss.xml` | News | Queensland items only | As above |
| 7NEWS Queensland | Seven West Media | `7news.com.au/news/qld/feed` | News | All items | No RSS-specific licence or terms page found. |
| 7NEWS Brisbane | Seven West Media | `7news.com.au/news/brisbane/feed` | News | All items | As above |
| Brisbane Times | Nine | `www.brisbanetimes.com.au/rss/feed.xml` | News | Queensland items only (the feed is its national and world front page) | Nine's site terms; no RSS-specific licence found. Nine sells reuse through its content licensing service. |
| Guardian Australia | Guardian News & Media | `www.theguardian.com/australia-news/rss` | News | Queensland items only | [Guardian terms of service](https://www.theguardian.com/help/terms-of-service): covers its RSS feeds and says use is "personal and non-commercial". |
| SBS News | SBS | `www.sbs.com.au/news/topic/latest/feed` | News | Queensland items only | [SBS terms](https://www.sbs.com.au/terms): material may be retrieved for personal, non-commercial purposes. |
| Police media releases | Queensland Police Service | `mypolice.qld.gov.au/feed/` | Official | All items, with the feed's whole summary paragraph | [QPS copyright](https://www.police.qld.gov.au/copyright): CC BY 4.0 for most material. |
| Earthquakes (last 7 days) | Geoscience Australia | `earthquakes.ga.gov.au/geoserver/earthquakes/wfs`, layer `earthquakes_seven_days`, `located_in_australia='Y'` | Official | Earthquakes GA describes as in or off QLD | CC BY 4.0 ([GA copyright](https://www.ga.gov.au/copyright)) |
| Council disaster dashboards | 58 Queensland councils, on the QIT Plus platform | `<dashboard>/dashboard/imsBulletin` (bulletins), `imsEvac` (centres), `getCameras` (cameras), `dashOutages` (council notices) and `energexOutages` (Energex power outages), for each dashboard in `src/data/council-dashboards.json` | Official | Bulletins from the last 48 hours: title and whole text (up to 700 characters), linked to the council's dashboard and filed under its council area. Every listed centre, camera, notice and outage, as written. | No licence published. The feed says "Copyright 2018 QIT Plus" and each council's terms of use cover general information and liability only. Bulletins, centres, notices and outages are the councils' own public safety notices, published to be passed on, and every item links to its dashboard. Camera images load from each council's camera host. |
| Queensland weather warnings | Bureau of Meteorology | `ftp://ftp.bom.gov.au/anon/gen/fwo/IDQ2xxxx.amoc.xml` | Official | Current warnings (product type W, status O, not cancelled or expired). **Off unless `NEWS_BOM_WARNINGS=on`.** | BoM default terms ([copyright](https://www.bom.gov.au/other/copyright.shtml), [anonymous FTP](https://www.bom.gov.au/catalogue/anon-ftp.shtml)): personal or in-house use; publishing is for registered users. Turn it on only once you have that permission. |

### Council disaster dashboards

The Queensland Government lists every council's disaster dashboard in a CSV behind its [Local government disaster dashboards](https://www.qld.gov.au/community/disasters-emergencies/disasters/resources-translations/local-government-disaster-dashboards) page. `npm run data:dashboards` reads that list and keeps the 58 dashboards that answer the QIT Plus platform's JSON feed, with each council's area in the place names gazetteer. The other 20 councils link to a web page, use another system (Brisbane City Council and Sunshine Coast Council's Disaster Hub), or didn't answer.

- **Bulletins** are the councils' own written updates. Their whole text is kept, up to 700 characters, because a council publishes them as public safety notices and the first sentence alone often leaves out the warning. A bulletin has no location of its own, so it is placed only where its text names a gazetteer place, and it is always filed under its council's area for the region filter. The platform's bulletin ids repeat, so the monitor identifies a bulletin by its dashboard, title and created time.
- **Centres** (the **Council centres** map layer) are evacuation centres, places of refuge, sandbag stations and the like, at the points the councils publish. The map colours them by keywords in the council's own type (`centreKind()` in `src/lib/councilCentres.ts`), and the page shows the type and status exactly as written. Councils open centres as needed, so the layer is often nearly empty. A council that doesn't answer keeps its last list.
- Eight dashboards (Gympie, Paroo, Quilpie, Redland, Richmond, Scenic Rim, Torres Strait Island and Yarrabah, as of October 2026) send an incomplete TLS certificate chain that Node rejects, so the server reads them over plain http, the address the state's list gives for most of them. People are always linked to the https address. Certificate checks are never turned off.
- **Cameras** join the **Traffic cameras** and **Flood cameras** layers and the Cameras tab, credited to their council, with the council as their district. A camera whose image comes from `cameras.qldtraffic.qld.gov.au`, or that sits within 30 m of a QLDTraffic camera of the same kind, is left out, because QLDTraffic already publishes it (`src/lib/councilCameras.ts`, `asCameras()` in `src/lib/cameras.ts`). Councils type cameras in their own words; a type that says "traffic" is a traffic camera, anything else a flood camera. Images load from each council's camera host (envault, sightmaster, disasterwatch and others) at the address the council gives, with the clock's minute added so they refresh.
- **Energex's own outage map** (`energex.com.au/outages/outage-finder/outage-finder-map/`) loads three GeoJSON files (current unplanned, current planned, future planned) that Roadbeat can't use: the whole site sits behind a bot check that blocks servers, the files send no CORS header for browsers, and Energex's terms of use prohibit using its intellectual property without written agreement. The councils' relay of the current unplanned list is the only route, and it carries no planned outages.
- **Outages and notices** (the **Outages and council notices** map layer) come from two feeds. `energexOutages` relays Energex's current power outages, which name a council area, suburb and streets but no point, so an outage is placed at its suburb's gazetteer point under the council area Energex names, and its page says "Located from". Energex filters the relay on some dashboards and not others, so the server reads every dashboard's copy and counts each event id once. Energex and Ergon block direct reads of their outage finders, and Ergon's area has no relay, so outages cover Energex's south-east network only. `dashOutages` holds notices councils enter themselves (water main shutdowns, fuel availability, anything they choose) with the council's own type and the shape the council drew; they are shown as drawn.

Not included:

- **9News** publishes no RSS feed: every `/rss` address on 9news.com.au returns 404. Its pages are not scraped.
- **The Courier-Mail** and the **Gold Coast Bulletin** (News Corp) return empty bodies from their `/rss` addresses, because they are paywalled.
- The BoM's HTTP warnings feed (`www.bom.gov.au/fwo/IDZ00056.warnings_qld.xml`) answers non-browser requests with 403.

The news outlets publish no licence for their feeds beyond their site terms, several of which say "personal, non-commercial". Roadbeat therefore uses each feed the way a feed reader does, and no further:

- For news outlets it stores and shows only the headline, the link, the publisher, the publisher's own dates, and the first sentence of the publisher's own summary, cut at 280 characters. Openly licensed official sources (Queensland Police, CC BY 4.0) keep the feed's whole summary paragraph, up to 700 characters. `summary` in `src/api/newsSources.ts` sets this per source. The monitor never fetches, stores or shows an article, an image or a video.
- Each report shows its publisher's own square site icon, loaded from the publisher's website, as feed readers do: the main outlets' from `PUBLISHER_ICONS` in `src/api/newsSources.ts`, a council's from the icon its own website declares (`<link rel="apple-touch-icon">` first, else the largest `<link rel="icon">`), found by `npm run data:dashboards` on the council's website, else its dashboard. An icon file that two councils serve is their web platform's default, not a council's mark, so it is dropped. All 58 councils have one. Logos are not copied into Roadbeat; a publisher without an icon gets a generic mark.
- Every report names its publisher and links to the original. A story says "Reported by" each outlet that carried it.
- Items are kept for 48 hours, then deleted.

Check with each publisher before using the monitor commercially or redistributing its feeds.

### How reports are placed and grouped

- **Live blogs** are marked only as their publishers mark them: an ABC title that starts "Live:", or a link with `live` as its own path part (ABC's `-live-` slugs, The Guardian's `/live/`). The label is "Live blog", a format, not a claim that the blog is updating this minute.
- **Updated** times appear when a feed gives a later date for a link the monitor already holds, as live blogs do. The first date is kept as published; the latest becomes `updated`, and a story sorts by it. An item is kept for 48 hours after its latest date.
- **Places** come only from exact, case-sensitive matches of whole words in the stored headline and summary against `src/data/qld-places.json`, built from the Department of Resources' *Place names gazetteer - Queensland* (data.qld.gov.au, CC BY 4.0) by `npm run data:places`. Only towns, suburbs, localities and neighbourhoods are used, each at the gazetteer's own point. Names the gazetteer places in more than one spot (The Gap), and names that are everyday words, common names or better-known places elsewhere (Banana, Laura, Manly, Richmond), are left out, as are team and masthead names such as "Brisbane Broncos". A story that names no place stays in the list without a pin. Each story says what located it: "Located from: Toowoomba". Earthquakes are pinned at Geoscience Australia's published epicentre instead.
- **Roads** are placed only when the stored text names a road and a gazetteer locality together. `roadNames()` in `src/lib/newsRoads.ts` reads names such as "Avaline Boulevard" or "Bruce Hwy" (spelt out as the dataset does), and the server asks the Department of Resources' *Queensland roads and tracks* service (data.qld.gov.au, CC BY 4.0, `spatial-gis.information.qld.gov.au/arcgis/rest/services/Transportation/RoadsAndTracks/MapServer/10`) for every segment of that road with the named locality on either side. The story draws those segments, never a point along them. A name found in localities of two different council areas is left unplaced, as it is most likely two different roads. A road named with no locality ("Bruce Highway" alone) is not drawn. Each run asks about at most 20 new or changed items; an item keeps its roads while its text is unchanged.
- **Official reports there now** on a story page lists QLDTraffic road events in effect whose locality is a place the story names, and QFD warnings whose area, title or location names one, matched by name only (`officialNow()` in `src/lib/newsOfficial.ts`). The page says they may not be the incident the story describes.
- **Stories** group news reports whose headlines share at least three content words, making up at least half of the shorter headline, published within 12 hours of a report already in the story. The same link in two ABC feeds is one report. Official items are never grouped, with news or with each other. A story counts each publisher once.
- **Region** filters use the council area the gazetteer gives each matched place. Police districts and BoM forecast districts are not mapped to council areas.
- Nothing is labelled verified, and nothing is scored for severity or sorted into categories, because no publisher gives those. Official notices are marked with their agency and drawn as solid dots; news reports are drawn as rings that grow with the number of outlets that carried the story. Stories that name the same place share one pin with a count, which opens the News list for that place, because the gazetteer has one point per name and a pin per story would hide all but the top one. The dashboard's **What's happening** strip ranks the last 6 hours' stories by that count, then by time.

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
| `src/data/council-dashboards.json` | The Queensland Government's list of local government disaster dashboards, checked for the QIT Plus feed: each council's name, gazetteer council area, dashboard address and feed address. Read only by the server. | `npm run data:dashboards` | 3 KB, server only |
| `src/data/qld-places.json` | Department of Resources *Place names gazetteer - Queensland* (data.qld.gov.au, CC BY 4.0): about 3,900 towns, suburbs and localities with one point each, for the news monitor. Read only by the server. | `npm run data:places` | 59 KB compressed, server only |
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
| `VITE_NEWS_URL` | `/api/news` | The news monitor endpoint |
| `VITE_AIR_QUALITY_URL` | `/air-quality` | The air quality feed proxy path |

## What the app links to instead of showing

The Bureau of Meteorology's flood warnings, and the minor, moderate and major flood levels for its gauges, are published under BoM's default terms: personal use only, not to be supplied to anyone else. Its web API says it must not be used. So the app doesn't show warning text or flood levels. A gauge page links to the BoM warning page for the gauge's catchment, using the catchment's product id from the CC BY *National Flood Gauge Network*.

TransLink reports lift and escalator outages as service alerts with the GTFS-RT effect `ACCESSIBILITY_ISSUE`, naming the stops they affect. Stop pages and the dashboard show them as published.
