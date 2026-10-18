# Refresh the published data

Translink publishes a new GTFS timetable every few weeks. The app's stops, timetables, tracks and route names are built from it, so rebuild them when Translink publishes a new one. A stale build still works, but its timetables stop at the old calendar's last day.

To see the dates the current build covers, look at `start` and `days` in `public/timetables/index.json`.

## Before you start

You need Node.js 22 or later, `unzip` on your `PATH`, and an internet connection. Each script downloads Translink's GTFS files itself.

## Rebuild everything from one download

The GTFS files are about 40 MB, almost all of it SEQ. To download them once and share them between the scripts:

1. Download every region's feed (the list in `scripts/lib/gtfs.mjs`) into an empty folder:

   ```bash
   mkdir -p /tmp/gtfs && for r in SEQ CNS NSI MHB BOW INN TSV MKY BUN GLT GYM KIL MAG MIF MAL RKY TWB WAR WHT; do curl -sL -o /tmp/gtfs/$r.zip https://gtfsrt.api.translink.com.au/GTFS/${r}_GTFS.zip; done
   ```

2. Run the scripts with `TRANSLINK_GTFS_DIR` pointing at that folder:

   ```bash
   TRANSLINK_GTFS_DIR=/tmp/gtfs npm run data:stops
   ```

   ```bash
   TRANSLINK_GTFS_DIR=/tmp/gtfs npm run data:timetables
   ```

   ```bash
   TRANSLINK_GTFS_DIR=/tmp/gtfs npm run data:tracks
   ```

3. Rebuild the route names. This script always downloads the feeds, because it also reads the T-code mapping from data.qld.gov.au:

   ```bash
   npm run data:routes
   ```

Each script prints what it wrote. `data:timetables` also prints the total and per-route compressed sizes. If the total grows far past the size given in [Published data built into the app](data-sources.md#published-data-built-into-the-app), check the output before you commit it.

## Rebuild the list of printable maps

Translink changes its maps page independently of the timetable. To rebuild the list:

```bash
npm run data:maps
```

The script prints the number of places and maps it found. If it finds fewer than 50 maps, it stops without writing anything, because the page layout has probably changed. In that case, update the parser in `scripts/build-maps.mjs`.

## Rebuild the Brisbane signal locations

Brisbane City Council adds and moves traffic signals occasionally. To rebuild the list the **Signal traffic** layer uses:

```bash
npm run data:intersections
```

The script prints how many intersections have a position. It stops without writing if it finds fewer than 500.

## Rebuild the bikeway network

When the council updates its bikeways, rebuild the simplified network:

```bash
npm run data:bikeways
```

## Rebuild the February 2022 flood extent

The council revises its flood awareness layers rarely. If it does, rebuild the simplified outline:

```bash
npm run data:flood2022
```

## Rebuild the statewide stream gauge list

When the Department of Local Government, Water and Volunteers opens or closes gauging stations, rebuild the station list:

```bash
npm run data:qld-gauges
```

The script reads the stream gauging station network list from data.qld.gov.au, asks the Water Monitoring Information Portal's web service for every station's latest stream height (about 20 seconds), keeps the stations that have one, and writes `public/qld-gauges.json`. It stops without writing if the list has fewer than 300 stations.

## Rebuild the past cyclone tracks

NOAA updates IBTrACS after each cyclone season. Once a season, after it does, rebuild the tracks:

```bash
npm run data:cyclones
```

The script downloads IBTrACS v04r01 for the South Pacific basin from NOAA NCEI and writes `public/cyclone-tracks.json`: every storm since the 1980 season with a reported position near Queensland (137° to 160° E, 9° to 30° S). It keeps only the positions the agencies reported and drops IBTrACS's interpolated 3-hourly points, so the map never draws a position nobody observed. It prints how many storms and positions it kept, and stops without writing if it finds fewer than 100 storms.

## Rebuild the gauge flood warning areas

When Brisbane City Council adds stream gauges, or BoM redraws its flood warning catchments, match each gauge to its catchment again:

```bash
npm run data:catchments
```

The script asks BoM's National Flood Gauge Network which catchment contains each stream gauge and writes `src/data/gauge-catchments.json`.

## Rebuild the news monitor's place names

```bash
npm run data:places
```

This downloads the Department of Resources' *Place names gazetteer - Queensland* from data.qld.gov.au and writes `src/data/qld-places.json`: towns, suburbs, localities and neighbourhoods, one point each. It leaves out names the gazetteer places in more than one spot, and the everyday words and common names listed in `COMMON` in `scripts/build-places.mjs`, keeping each of those only under its council area, as "Carina (Brisbane City)", wherever that council has one point for it. A headline never names a place that way, so news is unaffected, but Energex outages, which name the council, can still be placed. Add a name to `COMMON` if it places news stories where they don't belong. The gazetteer changes rarely; rebuild after it is republished.

## Rebuild the list of council disaster dashboards

```bash
npm run data:dashboards
```

This reads the Queensland Government's CSV of local government disaster dashboards, asks each one for the QIT Plus feed, and writes `src/data/council-dashboards.json` with the councils that answer, their council area, the address the server reads them from (http only when Node rejects the site's certificate chain) and the icon the council's website declares (its Apple touch icon, else its largest favicon), with any icon file shared by two councils dropped as a platform default. Rebuild when a council moves or replaces its dashboard; the script prints any council it couldn't match to a council area.

## Check the result

1. Run the tests and the build:

   ```bash
   npm test && npm run build
   ```

   The build also regenerates the directory pages under `dist/stations/`, `dist/lines/` and `dist/places/` and the sitemap from the refreshed stop, route, timetable index and gazetteer files (see [Architecture](architecture.md)); no separate step is needed. A route that disappears from the timetable loses its page, and `sitemap.xml` lists only pages that exist.

2. Start the app with `npm run dev`, open a line page such as T1 Caboolture, and compare a few times in the **Timetable** grid with the same line on [Translink's timetable pages](https://jp.translink.com.au/plan-your-journey/timetables).
