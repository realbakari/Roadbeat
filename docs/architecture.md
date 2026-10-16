# Architecture

This page explains how Roadbeat is put together and why. For the list of feeds, see [Data sources](data-sources.md).

## The rule behind every design decision

The app shows only what an official source publishes. It does not interpolate a time between two published stops, place a vehicle between two GPS reports, or guess a walking time. When a feature would need an estimate, the app either leaves the feature out or hands the user to the official tool that owns the estimate.

Some of the choices below look odd until you know this rule. The journey planner changes only at the same station, because a change between two stops needs a walking time, and no source publishes one. A vehicle slides to a new position for one second after a report arrives and then stops, because anything longer would show a position nobody reported.

## The app is a static site with a few small proxies

The browser does almost all of the work. `npm run build` produces a static site in `dist/` that any static host can serve.

Most sources send `Access-Control-Allow-Origin: *`, so the browser reads them directly. Four do not:

- TransLink's GTFS-RT feeds, read through `/translink-rt`.
- The Queensland Fire Department bushfire feed, read through `/qfd-bushfires`.
- The state's live air quality feed, read through `/air-quality`.
- The Queensland Water Monitoring Information Portal's web service, read through `/qld-gauges`. This proxy is not a plain rewrite: the service wants a POST naming every station, so the proxy sends that request itself and caches the answer for 5 minutes.

Brisbane City Council's gauge and signal feeds also send `Access-Control-Allow-Origin: *`, so the browser reads them directly.

In development, `vite.config.ts` proxies all four paths. In production, a Cloudflare Pages Function in `functions/` proxies each one and caches the response at the edge. `vercel.json` does the same on Vercel. Without a proxy, the app still runs: live vehicles and bushfire warnings show as unavailable.

## Code layout

```
src/
  api/          one module per source: fetch, parse into domain types, nothing else
  lib/          pure logic: filters, the journey planner, timetable grids, alert rules
  hooks/        polling and shared state (React hooks)
  components/   screens and panels; map/ holds the MapLibre layers and overlays
  data/         static JSON built from published data by scripts/ (qld-places.json is read only by the server)
  test/         fixtures shared by the unit tests
site/           the About, Privacy, Contact and 404 pages, llms.txt, and the Vite plugin that publishes them
scripts/        Node scripts that build src/data and public/ from published data
functions/      Cloudflare Pages Functions (the feed proxies)
public/         static files: per-route timetables, transit tracks
```

Each layer has one job.

- **`src/api/` is the boundary.** Each module fetches one source and turns the raw response into a typed domain object, such as `FireWarning`, `LiveVehicle` or `ScheduledTrip`. External JSON is validated here (`bushfires.ts` uses a zod schema) and nowhere else. Code outside `api/` trusts these types.
- **`src/lib/` is pure.** The planner, the timetable grid builder, the alert rules and the filters take data in and return data out. They have no React, no fetching and no global state, which is why the unit tests can run them directly.
- **`src/hooks/` owns polling.** Each hook fetches on an interval while something needs the data. `useTripUpdates` shares one poller between every component that shows departures, so a line page fetches the 2.6 MB TripUpdates feed once, not once per section.
- **`src/components/` renders.** Components call hooks and `lib/` functions. They do not parse feeds or compute schedules themselves.

## Search engines and AI agents read static pages

The app itself needs JavaScript, so `site/plugin.ts` gives search engines and AI agents a static surface. Each page in `site/pages/` is written once in Markdown and becomes an HTML page (`/about/`) and a Markdown page (`/about.md`). The home page's Markdown is rendered inside `#root` in `index.html`, so a crawler without JavaScript still reads a real heading and description. The app replaces it when it starts. The plugin also writes `robots.txt`, `sitemap.xml`, `llms.txt`, the web app manifest, and the meta tags and JSON-LD in `index.html`. `SITE_URL` and `CONTACT_EMAIL` set the absolute links and contact details (see [Deploy the app](deploy.md)).

### The directory pages

Everything inside the app lives behind a `#hash`, which search engines do not index, so the build also writes a crawlable page for each thing the app has a view of. `site/directory.ts` builds the model from the published data already in the repo: every train station, tram stop and ferry terminal in `src/data/translink-stops.json` that a route calls at, every line and route in `public/timetables/index.json` (the compact index, so the build never opens the timetable files) named from `src/data/translink-routes.json`, and every locality in `src/data/qld-places.json`. `site/directoryPages.ts` turns the model into pages written in the same Markdown subset as the trust pages, and `site/plugin.ts` renders each as `/stations/<slug>/`, `/lines/<slug>/` or `/places/<slug>/` with a Markdown twin, a breadcrumb trail (also as BreadcrumbList JSON-LD), an **Open in Roadbeat** button to the matching hash view, and, for stations and places, TrainStation, BoatTerminal or Place JSON-LD with the published coordinates. Three index pages (`/stations/`, `/lines/`, `/places/`) link them all, and the About page links the indexes.

The pages follow the accuracy rule in the static form: a line's stops are listed by name, because the compact index has no running order; a station's nearby localities and a locality's nearby stations are the published points within 5 km of each other; and nothing live (departures, delays, what is published at a place now) is baked into HTML, the page says it is in the app. SEQ train lines are one page per official T-line and open `#transit/line/train/<name>`, which the app resolves against TransLink's network status; every other route opens `#transit/route/<region>/<code>`, which needs only the timetable. Stops TransLink's data names as turnbacks or relief points are left out as operational. The whole directory, about 4,800 pages, builds in under a second and is rendered once per build or dev server. Every indexable page goes into `sitemap.xml`; past 50,000 URLs the plugin writes a sitemap index instead. The home page's JSON-LD adds a WebSite with a SearchAction that opens a locality page by name.

## Navigation lives in the URL hash

Every page has a hash route, so any view can be shared or bookmarked: `#event/123`, `#fire/WARN-10208`, `#transit/stop/SEQ/place_censta`, `#transit/route/TSV/V200` (a route outside SEQ, where TransLink's network status lists no lines), `#transit/plan/SEQ/place_fersta/place_dbnsta`, with an optional date, time, leave or arrive, and mode filter after the stops. `parseHash()` in `src/lib/route.ts` parses the hash into a selection, `useHashSelection()` in `src/hooks/useSelection.ts` keeps it in step with the URL, and `SidePanel` in `src/components/SidePanel.tsx` renders whatever is selected. There is no router library, because the app has one screen with a side panel and a map.

## A locality page gathers every source at one place

`#place/locality/<name>` opens a page for any town, suburb or locality in Queensland's place names gazetteer, with one section per source that publishes something there now: road events, bushfires, cameras, air quality stations, council centres, power outages, news stories and gauges. Each row opens the item's own page, and **On the map** flies to the locality with the layers those items are drawn on turned on. The gazetteer (`src/data/qld-places.json`, about 220 KB) is read only by the server for the news monitor, so `src/api/localities.ts` loads it in the browser on demand, in its own chunk, the first time a locality page opens. The matching is a pure function, `atLocality()` in `src/lib/locality.ts`, and it follows the accuracy rule: an item is listed only because its publisher named the locality (QLDTraffic's locality field, the Queensland Fire Department's area text, Energex's suburb, a story's gazetteer places) or published a position within 5 km of the gazetteer's point for it (cameras, stations, centres, gauges). Nothing is inferred from a road name, a council area or a map tile, so a report filed under a neighbouring suburb appears on that suburb's page instead. A source whose data is not loaded is named on the page rather than fetched, because turning a layer on is the viewer's choice. Story pages, outage pages and the camera card link to the locality they name.

## The dashboard and kiosk board have their own paths

`/dashboard` and `/kiosk/<region>/<stop id>` are separate full-screen views, not panels in the app. `parsePath()` in `src/lib/route.ts` picks the screen in `src/Root.tsx`, and each screen is loaded only when opened. The dashboard is a set of panels the viewer chooses and orders: `src/lib/dashboardLayout.ts` holds the registry and the layout rules, `src/dashboard/panels.tsx` and `panelsMonitor.tsx` hold one view per panel, and `Dashboard.tsx` reads only the feeds the shown panels need. The layout lives in the page link (`/dashboard?show=events,news,fires`), so a TV can be set up by URL, and otherwise in this browser. Hosts serve `index.html` for these paths: `vercel.json` and `public/_redirects` rewrite them. The dashboard's figures come from pure functions in `src/lib/dashboard.ts`. Its on-time share counts only trips with a vehicle reporting its position, because TransLink's feed also lists trips that haven't started, whose delay is just the timetable.

## The status page shows every feed's health and provenance

`/status` lists every feed the app reads, grouped by publisher, with its address, licence, read path, refresh cadence and code module, and the result of reading it from this browser. `src/lib/feedRegistry.ts` is the single source of truth for that list, one entry per row of the Live feeds table in [Data sources](data-sources.md); the page and its checks read it and list nothing themselves. `src/status/feedChecks.ts` pairs each entry with the app's own fetch function, so a feed counts as healthy only when its data parses, and marks the one feed the page cannot read on its own (camera image times, which need a pinned camera) as not checked rather than guessing. `src/status/useFeedHealth.ts` runs every check when the page opens and every two minutes after. The page shows the publisher's own time where a feed carries one (`events_v2`'s `published`, the news snapshot's `fetchedAt`, the air quality feed's measured hour) and never infers a status: "not checked" is a result in its own right.

## The API and MCP server share the app's parsing

`api/` holds Vercel functions: four REST endpoints and an MCP server (`api/mcp.ts`, Streamable HTTP, stateless). They fetch the official feeds directly, because servers need no CORS proxy, and cache each one in memory for 30 to 120 seconds. `api/_lib/tools.ts` turns the data into answers, and both the REST endpoints and the MCP tools call it, so they always agree.

The functions reuse the app's pure modules: `src/api/gtfsrt.ts` decodes TransLink's protobuf feeds, `src/api/bushfireFeed.ts` parses the bushfire feed, `src/lib/eventStatus.ts` decides whether an event is in effect, and `src/lib/departures.ts` builds departure lists. These modules must not use browser-only code such as `import.meta.env`, and their relative imports end in `.js` (see [Deploy the app](deploy.md)). `site/agents.ts` writes `/openapi.json` and `/.well-known/mcp.json`.

## Published timetables are prebuilt and loaded per route

TransLink's GTFS file holds about 3.7 million stop times. That is far too much to ship, so `scripts/build-timetables.mjs` compresses it at build time into one JSON file per route in `public/timetables/`.

The format removes repetition rather than precision. Most trips on a route share a stopping pattern and the same gaps between stops, so each distinct pattern is stored once, and a trip is just a pattern, a start minute, a service and a trip number. The days each service runs are a hex bitmask over the feed's calendar window. The result is about 1.1 MB compressed for every trip in the state, with a typical route under 1 KB. `tripsOnDay()` in `src/api/timetables.ts` decodes a file for one service day.

Times are copied from `stop_times.txt` to the minute. Arrival times are kept where they differ from departure times, because the planner needs the exact arrival to show a correct change time.

## Real-time sits on top of the timetable

Two TransLink feeds overlay the timetable:

- **TripUpdates** report predicted times and delays for trips running now or starting within about 85 minutes.
- **VehiclePositions** report where each tracked vehicle is.

`liveLookup()` in `src/lib/timetable.ts` matches a timetabled trip to its TripUpdate by the trip number at the start of the GTFS trip id. A trip id repeats on every day the trip runs, so a match counts only within six hours of the timetabled time. ADDED trips are never matched: their ids can carry an older timetable version (`QR 26_27-44306` against the published `44307`) and reuse a timetabled trip's number, and an ADDED trip from the night before can stay in the feed into the next afternoon.

The app follows the TransLink app's convention for delays: the scheduled time, with the reported delay beside it as `+3` or `+0`. It shows `+0` only when a vehicle is reporting its position. Without a tracked vehicle, a zero delay is a schedule, not an observation.

Departure lists lead with minutes to go, as station screens and the kiosk do, counting to the reported time. The scheduled clock time stays beside or below the countdown, and a departure an hour or more away shows its clock time instead. The stop page's time toggle switches back to clock times and is remembered in `qldt-time-format`.

## The trip page shows one run, stop by stop

Tapping a departure on a stop page, a line page, a timetable or a vehicle opens `#transit/trip/<region>/<trip id>/<route>[/<service day>]`, rendered by `TripPage` in `src/components/TripPage.tsx`. The trip id is the GTFS trip id from the real-time feed, or only its leading number for a trip picked from the timetable. The route names the timetable file to load, and the service day picks one run when the link names it. Without a day, `pickRun()` in `src/lib/trip.ts` takes the run the TripUpdates feed reports, or else the run in progress or nearest now.

`tripStops()` lists the published stops in order. For each stop it adds only what the TripUpdate reports for that stop, matched by stop id or another platform of the same station. Stops the feed omits show the timetable alone; nothing is filled in between, and an omitted stop is never called skipped, because the feed often leaves out a trip's last stops. Where the feed's stops differ from the timetable, the page says so, stop by stop: a stop the feed marks SKIPPED is struck out as not stopping, a stop on another platform of the same station shows the feed's platform with the timetabled one beside it, and a stop the feed lists that the timetable doesn't is placed after the feed stop before it and drawn on a dashed stretch of the line. Bus diversions show up this way, for example a stop named "… CLOSED" on a route that normally misses it. A line above the stops counts the changes. A stop is marked passed only when the reporting vehicle names a later stop as its current one. A trip the timetable lacks, such as an extra service, lists the feed's own stops. The page says the trip is cancelled only when its TripUpdate has the CANCELED relationship.

## Overdue departures are stated, not judged

A stop page lists a published departure as "Due 3:15 pm · 10 min past, no vehicle reporting" when `overdueMinutes()` in `src/lib/trip.ts` finds all of these:

- its time passed within the last 30 minutes;
- no vehicle reports the trip;
- the TripUpdates feed never listed the trip while the app polled it without a break, from before the trip's timetabled start until after the due time.

The last condition matters because TransLink often drops a trip's final stops from TripUpdates. In October 2026 about 30% of trips in the feed ended before their timetabled last stop, some by two hours, so a trip missing from one snapshot may simply have passed its last listed stop. The shared TripUpdates poller in `src/hooks/useTrafficData.ts` records every trip it sees with `watchFeed()`, and restarts the watch after a gap of more than three minutes, such as while the page was hidden. So the flag appears only for trips that start after the page began checking. Vehicle positions must have loaded too, so an outage on our side never reads as a missing vehicle. The row says what the feeds show and nothing more: it never says cancelled, because only TransLink's feed can.

## Stop pages lead with the next service

A stop page puts its next service from TransLink's real-time feed in a card of its own, with the scheduled clock time, minutes to go, route, platform and whether it is tracked, as Transit Pulse's route page does. The published timetable below it splits the day into Now, AM (4am to noon), PM (noon to 7pm) and Night (7pm to 4am), using `bandOf()` in `src/lib/timeBands.ts`. A "Last" badge marks the last departure of each service day on each line to each destination, from `lastServices()`. It looks at every departure loaded for the day, including those after midnight, because a service day can run past midnight and an 11:30 pm train is not the last if the same day's timetable has a 12:15 am one.

## Saved trips re-plan from the timetable

"My trips" follows TripView: a saved from → to pair, with the planner's mode and "direct only" filters, shown on the Transit home with its next four departures. Each card runs the same `planJourneys()` as the planner over today's published trips, then `filterJourneys()` and `nextJourneys()` in `src/lib/savedTrips.ts`. A journey stays listed until both its published departure and the departure TransLink reports for its first ride have passed, so a late service is not dropped early. The card copies TripView's layout: the trip edged in the colour of the line it next leaves on, and each departure with its minutes to go in a block of that line's colour, the boarding platform and published departure on the left, and the published arrival and route on the right. Each line is labelled Real-time when a vehicle on the first ride is reporting its position, and Scheduled otherwise. "On time" appears only for a tracked vehicle, and a reported delay without one reads "Scheduled · reported 3 min late". TransLink service alerts on the shown routes sit under the card, and the list ends with the time of the real-time feed it used. Tapping a card opens the planner at `#transit/plan/<region>/<from>/<to>/now/now/leave/<modes>`, built by `planHash()` in `src/lib/route.ts`. The list, with each trip's name and order, is kept in `qldt-saved-trips`.

## Train lines come from two official sources that disagree

TransLink's T-code mapping files each Queensland Rail route under the line it ends on. A Nambour train that runs through Caboolture is filed under T1 Nambour, not T1 Caboolture. TransLink's own Caboolture timetable lists it anyway. `timetableCodes()` in `src/lib/transitLines.ts` reconciles the two by adding the train routes that call at the line's terminus and also stop at every station the line's own trains stop at. That matches TransLink: T1 Caboolture lists Nambour trains, which stop everywhere from Caboolture in, but not Gympie North trains, which run express past Morayfield to Dakabin.

## The map

`src/components/TrafficMap.tsx` creates one MapLibre map and keeps it for the life of the app. Theme and base map changes swap the style. When a style loads, `addLayers()` in `src/components/map/layers.ts` re-adds every app layer, and `ready` changes so the data effects push their data again.

Track lines come from TransLink's GTFS shapes. Those shapes follow the middle of a rail corridor, about 2 m from each rail of a double track. Storing them more precisely does not bring them closer to the rails. When zoomed in, the map draws them as a translucent band wide enough to cover the corridor, so the base map's individual rails show through.

Map animation follows the same rule as the data. The **Signal traffic** layer does not animate red, amber and green lights, because the council's feed has no phase timing. It rings intersections whose measured saturation changed in the newest batch, and it pulses a halo on intersections at 100% or more. `useSignalAnimation` in `src/components/map/` runs both, and turns them off when the viewer's system asks for reduced motion.

## Notifications run in the app; commute alerts can also be pushed

In-app notifications need no server. `useNotifications` in `src/hooks/useNotifications.ts` compares each refresh with the last one it saw, which it keeps in `localStorage`. It raises a notification for new or changed items that match the user's settings. Items that changed while the app was closed appear as "While you were away" on the next visit.

Commute push alerts are the one exception, and riders opt in. The browser subscribes with the server's VAPID key (`src/api/push.ts`, `public/sw.js`) and sends the subscription and its commute to `api/push.ts`, which stores them in Upstash Redis. Every five minutes a GitHub Actions workflow calls `api/push-check.ts`. It checks only commutes inside their window, runs `commuteAlerts()` from `src/lib/commute.ts` (the same rules the in-app card uses) and sends each alert once. The service worker shows alerts and caches nothing.

## The news monitor reads feeds on the server

The **News** tab follows the same rule as everything else: it shows what publishers published, and estimates nothing. `api/news-ingest.ts` reads ABC, 7NEWS, Brisbane Times, Guardian Australia and SBS RSS feeds, Queensland Police media releases and Geoscience Australia earthquakes every 5 minutes, and stores the last 48 hours in Upstash Redis. It keeps only each item's headline, link, publisher, date and the first sentence of its summary. `api/news.ts` serves them; without a store it reads the feeds itself, at most once per 5 minutes per warm function.

The pure parts sit where they always do. `src/api/newsFeeds.ts` parses RSS, the BoM's AMOC files and GA's WFS. `src/lib/newsItems.ts` cuts items down and merges runs, `src/lib/newsPlaces.ts` matches place names, and `src/lib/newsStories.ts` groups reports into stories and filters them. The browser groups stories itself, so the News tab, the map, the dashboard strip and news alerts all use one function.

A story is placed only where its stored headline or summary names a place in Queensland's place names gazetteer, exactly. When the text also names a road in that place, the server draws that road's segments there from the state's roads dataset (`src/api/qldRoads.ts`, `src/lib/newsRoads.ts`).

The same run reads 58 council disaster dashboards (`src/api/councilDashboard.ts`): their bulletins join the news items as official reports, and the centres, cameras, Energex outages and notices they list go into the same snapshot for the **Council centres**, camera and **Outages and council notices** map layers (`src/lib/councilCentres.ts`, `src/lib/councilCameras.ts`, `src/lib/outages.ts`). It is not placed where the report happened, which no feed publishes. Each story says which name placed it. Reports are grouped only by shared headline words within 12 hours, and a story counts outlets, not truth: nothing is labelled verified, and official items are never grouped with news. See [Data sources](data-sources.md#news-monitor-feeds) for the feeds, their terms and the matching rules.

## The timeline replays what was published, not what happened

The **Replay** bar on the map, and the **Replay the last 48 hours** dashboard panel, scrub back over the last 48 hours. The same rule holds as everywhere else: a replay shows only what a source had published by the chosen time, each item at its publisher's own time, and nothing is interpolated. News items are shown once their publisher's date has passed, and council gauges show only the readings taken by then (`src/lib/timeline.ts`, `replayAt()`). Every other layer stays live, and a banner says the view is not.

QLDTraffic publishes only the present, so the server keeps the only record of the past. The news monitor's 5-minute run (`api/news-ingest.ts`) also reads the events feed and records which events were in effect, as the official site counts them, under one Redis key (`api/_lib/eventHistoryStore.ts`). The record is compact: one row per read (`runs`, with the feed's own `published` stamp and a count) and one row per published version of an event (`events`, keyed by id and `last_updated`), holding only its times, type, priority, closure flag, anchor point and road, plus the runs it was seen at as `[first, last]` pairs. A version is never extended past a read that did not include it. `src/api/historyTypes.ts` defines the shape and `src/lib/eventHistory.ts` merges a read in and prunes to 48 hours, 600 reads and 900 KB. `/api/history` (`api/_lib/endpoints/history.ts`) serves it, and records a read itself if the stored record is 15 minutes old; without a store it serves what the warm function has read since it started, and says so.

A replay shows events as of the nearest read at or before the chosen time, never a later one and never a guess between reads, and the bar names that read: "as of the 10:35 read, the last before 10:40". A time before the record starts shows no events, and says that too.

## What the browser remembers

Preferences live in `localStorage`, so they stay in one browser and never reach a server.

| Key | Holds |
| --- | --- |
| `qldt-alert-settings` | Notification settings |
| `qldt-notifications`, `qldt-seen` | The notification list and the last state seen |
| `qldt-saved-stops`, `qldt-recent-stops`, `qldt-saved-trips` | My stops, Recent stops and My trips |
| `qldt-panel`, `qldt-basemap`, `qldt-time-format` | Panel size, base map style and departure time format |
| `qldt-dashboard` | Which dashboard panels show, in what order |
