# Roadbeat

Roadbeat is a free web app for Queensland's live road conditions and public transport. It shows the official QLDTraffic road events, traffic cameras, TransLink buses, trains, trams and ferries, published timetables, a journey planner, and Queensland Fire Department bushfire warnings on one map.

The app shows only data that an official source publishes. It never estimates a time, a position, or a delay. Where a source has a gap, the app says so instead of filling it.

It is built with React 19, [Kumo](https://kumo-ui.com/) (Cloudflare's component library), MapLibre GL and Vite.

## What it does

- **Road events.** Crashes, hazards, flooding, congestion, roadworks and closures from the QLDTraffic feed, refreshed every 60 seconds, with filters, event pages and road contacts.
- **Cameras.** Traffic and flood cameras on the map and in a searchable grid.
- **Live transport.** TransLink vehicle positions every 15 seconds, train, tram and ferry lines with their stations, and TransLink service alerts.
- **Timetables.** Every published trip on every route, as a stop-by-trip grid per line and a full day's list per stop, with real-time delays on today's trips. Tap any departure for that trip's stops in order, with TransLink's real-time time where the feed gives one and the vehicle's last reported position.
- **Overdue departures.** A stop page states when a timetabled departure has passed, no vehicle reports it and TransLink's real-time feed hasn't listed it while the page was checking, as "Due 3:15 pm · 10 min past, no vehicle reporting". It never calls a trip cancelled unless TransLink's feed does.
- **Journey planner.** Direct trips and trips with one change at the same station or stop, built from the published timetable. Trips that need a walk link to TransLink's own planner.
- **My trips.** Save a from → to trip, as in TripView, and the Transit home lists its next departures from the published timetable, counting down, with TransLink's real-time delay where reported.
- **Bushfire warnings.** Queensland Fire Department warnings and incidents on the map, in the events list and in notifications.
- **Satellite hotspots and imagery.** Geoscience Australia's satellite hotspots for the last 24 hours, labelled as heat detections rather than fires, each with its satellite, time and position accuracy, and NASA's daily true-colour satellite image for a chosen day.
- **Fire bans, border fires and cyclones.** The Queensland Fire Department's fire bans in its own words, NSW Rural Fire Service incidents just south of the border, the US Joint Typhoon Warning Center's current cyclones near Australia (labelled as not the official Australian warning), and past cyclone tracks near Queensland since 1980 from NOAA's IBTrACS.
- **Model forecast.** On each place page, the next day of the DWD ICON weather model via Open-Meteo, labelled as raw computer output with its run time.
- **Stream gauges and signals.** Brisbane City Council's live stream heights and rainfall, and the latest stream height at about 400 Queensland Government gauging stations across the state, shown on the map and next to nearby flooding events. Each council gauge links to the Bureau of Meteorology's flood warning for its area, and each state gauge to its page on the Water Monitoring Information Portal. Also how busy each council-run traffic signal is right now.
- **Air quality.** The state's monitoring stations on the map, each coloured by the department's worst rating this hour, with every reading and its rating on the station page, and the department's hourly history for any pollutant over a day, week or month, with its published guidelines.
- **Low clearances.** Signed clearances of about 20 low Brisbane City Council structures and about 100 Queensland Rail bridges in South East Queensland, for truck and caravan drivers, each with its owner's phone number and the date the council validated it or Queensland Rail's extract was taken.
- **Clearways, toilets and accessible parking.** Brisbane City Council clearways on the map, red while their signed times are in effect, plus public toilets with their accessibility features and accessible parking bays with their signed times.
- **Parking meters and cycling.** Brisbane parking meters with their hours, maximum stay and rates, and the council's bikeway network with bike racks and repair stations.
- **February 2022 flood extent.** The council's adopted outline of the 2022 Brisbane River and creek flood, as an optional map layer for context.
- **Council road closures.** Brisbane City Council's planned lane and road closures for today, above the road events list.
- **Council events.** Brisbane City Council's events on today and the next 7 days on the map, each with the council's own date text, venue, cost, age, bookings, meeting point, description and event image, and a link to the council's page.
- **Station and terminal access.** Lift and escalator outages from Translink, Queensland Rail's access details and facilities on every train station page, the council's access details on CityCat and ferry terminal pages, and its boarding, gradient and cross-fall ratings on Brisbane bus stop pages.
- **Notifications.** Alerts for events, routes and bushfire warnings that match your settings, while the app is open.
- **Network dashboard.** A full-screen overview at `/dashboard` for a TV or second monitor: closures and crashes by district, how tracked trains and buses are running, lift outages, bushfire warnings, the fastest-rising Brisbane creeks, the busiest intersections, Brisbane's key corridor travel times, today's council events, yesterday's CBD foot traffic, CBD car park spaces and a ticker of the latest events.
- **Kiosk departure board.** A large, self-refreshing board for one stop at `/kiosk/<region>/<stop id>`, opened from any stop page.
- **API and MCP server.** Free, read-only answers for AI agents and apps: Queensland road events, TransLink departures and bushfire warnings at `/mcp` and `/api/*`, described in `/openapi.json` and `/llms.txt`.
- **My commute.** Save your roads, stop, line and usual departure once. From 90 minutes before you leave, a card at the top of the road events list shows events on your roads, your service's real-time departures and alerts, and bushfire warnings near your stop.
- **Visitor count.** The header shows how many people are using Roadbeat now and today, counted on the server without cookies from a daily-rotating hash, and Vercel Web Analytics counts page views for the dashboard.
- **Maps.** Every printable map TransLink publishes, by place, and a choice of base map styles with 3D buildings.

## Support

Roadbeat is free, with no ads or accounts. If it's useful to you, you can support it at [Buy Me a Coffee](https://buymeacoffee.com/realbakari).

## Run it locally

You need Node.js 22 or later and `unzip` (for the data build scripts).

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open the URL that Vite prints, usually http://localhost:5173.

The development server proxies the TransLink and Queensland Fire Department feeds, so live transport and bushfire warnings work locally.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the Vite development server with the feed proxies. |
| `npm run build` | Type-checks the project and builds the static site into `dist/`. |
| `npm run preview` | Serves the built site with the same proxies as `dev`. |
| `npm test` | Runs the unit tests once with Vitest. |
| `npm run test:watch` | Runs the unit tests and re-runs them when files change. |
| `npm run lint` | Lints the project with oxlint. |
| `npm run data:routes` | Rebuilds `src/data/translink-routes.json` from TransLink's GTFS. |
| `npm run data:stops` | Rebuilds the stop and trip tables in `src/data/`. |
| `npm run data:timetables` | Rebuilds the per-route timetables in `public/timetables/`. |
| `npm run data:tracks` | Rebuilds the train, tram and ferry tracks in `public/transit-tracks.json`. |
| `npm run data:maps` | Rebuilds the list of TransLink's printable maps in `src/data/translink-maps.json`. |
| `npm run data:intersections` | Rebuilds Brisbane City Council's signal locations in `src/data/bcc-intersections.json`. |
| `npm run data:qld-gauges` | Rebuilds the statewide stream gauging station list in `public/qld-gauges.json`. |

## Documentation

- [Architecture](docs/architecture.md) explains how the app is put together and why.
- [Data sources](docs/data-sources.md) lists every feed and dataset, where it comes from, how often it changes, and its licence.
- [Refresh the published data](docs/refresh-data.md) shows how to rebuild the timetables, stops, tracks and maps when TransLink publishes new ones.
- [Deploy the app](docs/deploy.md) covers static hosting and the feed proxies.
- [Contributing](docs/contributing.md) sets out the code conventions, the accuracy rule and how to test a change.

Roadbeat also publishes [About](site/pages/about.md), [Privacy](site/pages/privacy.md) and [Contact](site/pages/contact.md) pages, and an [`llms.txt`](site/llms.txt) for AI agents.

## Licence

Road and transport data © State of Queensland (Department of Transport and Main Roads, Translink, Queensland Fire Department, Department of Local Government, Water and Volunteers) and Brisbane City Council, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Base maps © OpenFreeMap, OpenMapTiles and OpenStreetMap contributors. This is an independent project and is not affiliated with the Queensland Government.
