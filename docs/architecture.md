# Architecture

This page explains how Roadbeat is put together and why. For the list of feeds, see [Data sources](data-sources.md).

## The rule behind every design decision

The app shows only what an official source publishes. It does not interpolate a time between two published stops, place a vehicle between two GPS reports, or guess a walking time. When a feature would need an estimate, the app either leaves the feature out or hands the user to the official tool that owns the estimate.

Some of the choices below look odd until you know this rule. The journey planner changes only at the same station or stop, because a change between two stops needs a walking time, and no source publishes one. A vehicle slides to a new position for one second after a report arrives and then stops, because anything longer would show a position nobody reported.

## The app is a static site with a few small proxies

The browser does almost all of the work. `npm run build` produces a static site in `dist/` that any static host can serve.

Most sources send `Access-Control-Allow-Origin: *`, so the browser reads them directly. Six do not:

- Translink's GTFS-RT feeds, read through `/translink-rt`.
- The Queensland Fire Department bushfire feed, read through `/qfd-bushfires`.
- Queensland's severe weather, flood and cyclone warnings, read through `/qld-warnings`.
- The Queensland Fire Department fire ban feed, read through `/qfd-firebans`.
- The state's live air quality feed, read through `/air-quality`.
- The Queensland Water Monitoring Information Portal's web service, read through `/qld-gauges`. This proxy is not a plain rewrite: the service wants a POST naming every station, so the proxy sends that request itself and caches the answer for 5 minutes.

Brisbane City Council's gauge and signal feeds also send `Access-Control-Allow-Origin: *`, so the browser reads them directly.

In development, `vite.config.ts` proxies all six paths. Production runs on Vercel, where `vercel.json` rewrites five of them and `api/qld-gauges.ts` serves `/qld-gauges`. On Cloudflare Pages, a function in `functions/` proxies each one and caches the response at the edge. For what still works without a proxy, see [Without the proxies](deploy.md#without-the-proxies).

## Code layout

```
src/
  api/          one module per source: fetch, parse into domain types, nothing else
  lib/          pure logic: filters, the journey planner, timetable grids, alert rules
  hooks/        polling and shared state (React hooks)
  components/   screens and panels; map/ holds the MapLibre layers and overlays
  dashboard/    the /dashboard screen and its panels, and the /kiosk departure board
  status/       the /status page and its feed checks
  data/         static JSON built from published data by scripts/ (qld-places.json is read only by the server)
  test/         fixtures shared by the unit tests
api/            Vercel functions: the public API, the MCP server, news, push alerts and the feed proxy for /qld-gauges
  _lib/         code the functions share, and the handlers behind api/[endpoint].ts (not deployed on its own)
site/           the Vite plugin that writes the static pages, llms.txt, openapi.json and the directory pages
  pages/        the home page's description (index.md) and the About, Privacy, Contact and 404 pages
middleware.ts   Vercel middleware: serves the Markdown twin of a page to agents that ask for it
functions/      Cloudflare Pages Functions: the six feed proxies, /api/camera-time and the Markdown middleware
scripts/        Node scripts that build src/data and public/ from published data
public/         static files copied into the build: per-route timetables, transit tracks, cyclone tracks, gauge
                stations, flood and bikeway outlines, icons, the service worker, and _headers and _redirects
```

Each layer has one job.

- **`src/api/` is the boundary.** Each module fetches one source and turns the raw response into a typed domain object, such as `FireWarning`, `LiveVehicle` or `ScheduledTrip`. External JSON is validated here (`bushfires.ts` uses a zod schema) and nowhere else. Code outside `api/` trusts these types.
- **`src/lib/` is pure.** The planner, the timetable grid builder, the alert rules and the filters take data in and return data out. They have no React, no fetching and no global state, which is why the unit tests can run them directly.
- **`src/hooks/` owns polling.** Each hook fetches on an interval while something needs the data. `useTripUpdates` shares one poller between every component that shows departures, so a line page fetches the TripUpdates feed once, not once per section.
- **`src/components/` renders.** Components call hooks and `lib/` functions. They do not parse feeds or compute schedules themselves.

## Search

The header's **Search** button (or `/`, or Cmd/Ctrl+K) opens one search over everything the app has loaded: `searchIndex()` and `searchIn()` in `src/lib/search.ts`, shown by `src/components/GlobalSearch.tsx`. The index is built once each time the data changes, not on every key press. It matches whole words of each item's published name and place, and ranks a match in the name above one only in its suburb, council or district, so "Central" finds Central station before everything in the Central Highlands. Results are grouped by kind, best group first, at most five of each. The search reads three small lists itself once someone types: the gazetteer's towns and suburbs, the train, tram and ferry stops, and Translink's lines. Everything else comes from layers that are already on, and the footer names the layers that aren't, rather than fetching them. The last six results opened are kept in this browser (`src/lib/searchRecent.ts`).

## What's serious, first

The strip under the header (`src/components/MajorStrip.tsx`) leads with the most serious item any feed publishes: an Emergency Warning, then a QLDTraffic Red Alert, then Watch and Act, in the publishers' own levels (`majorIncidents()` in `src/lib/majorIncidents.ts`). It shows at every width while one exists. Below the width where the header has room for its counts, it always shows, with warnings, current closures and Red Alerts as shortcuts into the list, and when road events were updated. A count whose feed hasn't loaded shows "…", never 0.

The event list opens with Queensland Disaster Management's warnings (`src/components/WarningList.tsx`), then bushfires, then council works, then road events. The warnings card opens by itself while any warning is at Watch and Act or higher. Each road event's row has one line of what it does to the road, in QLDTraffic's words: the impact, direction and delay it publishes (`impactLine()` in `src/lib/eventText.ts`), in red with the closed sign for a road closure.

## Times and empty lists

A relative time such as "3 hours ago" is `src/components/ui/RelativeTime.tsx`: a `<time datetime>` whose exact Brisbane time shows on hover, keyboard focus or tap, and which screen readers hear in full ("3 hours ago, Sun, 18 Oct, 2:12 pm AEST"). Inside a button or clickable card it can't take focus, so it gives the exact time as a hover title and to screen readers only. `useNow` stops its clock while the tab is hidden.

A list with nothing to show uses `src/components/ui/StateMessage.tsx`, placed where its first row would be. `LoadFailed` says "Failed to load …", names the source and the error, and offers a retry, so a feed that didn't load never reads as "none reported". `NoResults` repeats the search that matched nothing and offers one action, clearing the search and filters. Road events and news show the failure until their first successful load, after which a failed refresh keeps the last data and the header says it's delayed.

## Search engines and AI agents read static pages

The app itself needs JavaScript, so `site/plugin.ts` gives search engines and AI agents a static surface. Each page in `site/pages/` is written once in Markdown and becomes an HTML page (`/about/`) and a Markdown page (`/about.md`). The home page's Markdown is rendered inside `#root` in `index.html`, so a crawler without JavaScript still reads a real heading and description. The app replaces it when it starts. The plugin also writes `robots.txt`, `sitemap.xml`, `llms.txt`, the web app manifest, and the meta tags and JSON-LD in `index.html`. Its parts are small files beside it: `markdown.ts` (the Markdown subset), `head.ts` (meta tags and JSON-LD), `pageHtml.ts` (the HTML shell), `pageLayout.ts` and `pageStyle.ts` (the page layout and its stylesheet), `sitemap.ts` (robots and sitemap), `manifest.ts` and `settings.ts`. `SITE_URL` and `CONTACT_EMAIL` set the absolute links and contact details (see [Deploy the app](deploy.md)).

### How the static pages look

The pages follow the component patterns of the [Queensland Government Design System](https://www.designsystem.qld.gov.au/components), in Roadbeat's own colours. Roadbeat is not a government site, so it borrows the patterns and not the Queensland Government brand: no coat of arms, government header or "Queensland Government" name.

- **Skip link, header and footer.** A skip link, a header with the main links and an **Open the app** button, and a dark footer of link columns.
- **Banner.** A banner holds the breadcrumbs, the page's title, its first paragraph as the lead, and the **Open in Roadbeat** button. `splitLead` in `pageLayout.ts` takes the title and lead from the rendered Markdown.
- **On this page.** A page with 3 to 12 sections gets an **On this page** list, beside the text on wide screens. Long indexes keep their own jump list instead.
- **Callouts and alerts.** In the Markdown, a quote (`> …`) becomes a callout, and a quote that opens with `[!NOTE]` or `[!WARNING]` becomes an in-page alert. Both stay plain Markdown in the `.md` twin.
- **Link columns.** A list of nothing but links is set in columns.
- **Light and dark.** Light or dark mode follows the app's own choice, or the system's.

### The directory pages

Everything inside the app lives behind a `#hash`, which search engines do not index, so the build also writes a crawlable page for each thing the app has a view of. `site/directory.ts` builds the model from the published data already in the repo: every train station, tram stop and ferry terminal in `src/data/translink-stops.json` that a route calls at, every line and route in `public/timetables/index.json` (the compact index, so the build never opens the timetable files) named from `src/data/translink-routes.json`, and every locality in `src/data/qld-places.json`. `site/directoryPages.ts` turns the model into pages (one builder per kind: `stationPage.ts`, `linePage.ts`, `placePage.ts` and `directoryIndexes.ts`, sharing `pageKit.ts`) written in the same Markdown subset as the trust pages, and `site/plugin.ts` renders each as `/stations/<slug>/`, `/lines/<slug>/` or `/places/<slug>/` with a Markdown twin, a breadcrumb trail (also as BreadcrumbList JSON-LD), an **Open in Roadbeat** button to the matching hash view, and, for stations and places, TrainStation, BoatTerminal or Place JSON-LD with the published coordinates. Three index pages (`/stations/`, `/lines/`, `/places/`) link them all, and the About page links the indexes.

The pages follow the accuracy rule in the static form: a line's stops are listed by name, because the compact index has no running order; a station's nearby localities and a locality's nearby stations are the published points within 5 km of each other; and nothing live (departures, delays, what is published at a place now) is baked into HTML, the page says it is in the app. SEQ train lines are one page per official T-line and open `#transit/line/train/<name>`, which the app resolves against Translink's network status; every other route opens `#transit/route/<region>/<code>`, which needs only the timetable. Stops Translink's data names as turnbacks or relief points are left out as operational. The whole directory, about 4,900 pages as of October 2026, builds in under a second and is rendered once per build or dev server. A locality with no station within 5 km has nothing on its page but the gazetteer point and the app link, the same for thousands of places, so those pages are `noindex`: they stay for people who follow a link but are left out of search. Every indexable page goes into `sitemap.xml`; past 50,000 URLs the plugin writes a sitemap index instead. The home page's JSON-LD describes the WebSite, the WebApplication and the Organization behind them, written once and referred to by `@id`; each station and place entity carries its page's `url` and `@id`.

## Navigation lives in the URL hash

Every page has a hash route, so any view can be shared or bookmarked: `#event/123`, `#fire/WARN-10208`, `#transit/stop/SEQ/place_censta`, `#transit/route/TSV/V200` (a route outside SEQ, where Translink's network status lists no lines), `#transit/plan/SEQ/place_fersta/place_dbnsta`, with an optional date, time, leave or arrive, and mode filter after the stops. `parseHash()` in `src/lib/route.ts` parses the hash into a selection, `useHashSelection()` in `src/hooks/useSelection.ts` keeps it in step with the URL, and `SidePanel` in `src/components/SidePanel.tsx` renders whatever is selected. There is no router library, because the app has one screen with a side panel and a map.

The map's view sits in the query string beside the hash, so a shared link opens the same base and layers: `?base=satellite&image=jma-truecolour&layers=fires,warnings,radar`. `searchWithView()` and `viewFromSearch()` in `src/lib/viewUrl.ts` write and read it, leaving out anything at its default so an untouched map keeps a clean address, and `App.tsx` replaces the address as the view changes. A linked base and image are used for that visit without overwriting the base and image the visitor's browser remembers (`qldt-base`, `qldt-satellite`).

Link previews never see the hash: Slack, WhatsApp, iMessage, Facebook and X fetch the URL without it, so every hash link unfurls as the home page. A road event's Copy link therefore gives `/api/share?event=<id>` (`src/lib/sharePage.ts`, served by `api/_lib/endpoints/share.ts`): a small page whose title and preview tags carry QLDTraffic's own road name, type, place and description, and which redirects to `#event/<id>`. Other views are still shared as hash links and unfurl as the home card. Stations, lines and places have static pages under `/stations/`, `/lines/` and `/places/` with their own previews, but the app can't link to them yet, because their slugs are made when the site is built and the app doesn't load that list. Bushfires, stops and planned trips would need share pages like the event one, reading their feeds on the server.

## A locality page gathers every source at one place

`#place/locality/<name>` opens a page for any town, suburb or locality in Queensland's place names gazetteer, with one section per source that publishes something there now: road events, bushfires, cameras, air quality stations, council centres, power outages, news stories and gauges. Each row opens the item's own page, and **On the map** flies to the locality with the layers those items are drawn on turned on. The gazetteer (`src/data/qld-places.json`, about 220 KB) is read only by the server for the news monitor, so `src/api/localities.ts` loads it in the browser on demand, in its own chunk, the first time a locality page opens. The matching is a pure function, `atLocality()` in `src/lib/locality.ts`, and it follows the accuracy rule: an item is listed only because its publisher named the locality (QLDTraffic's locality field, the Queensland Fire Department's area text, Energex's suburb, a story's gazetteer places) or published a position within 5 km of the gazetteer's point for it (cameras, stations, centres, gauges). Nothing is inferred from a road name, a council area or a map tile, so a report filed under a neighbouring suburb appears on that suburb's page instead. A source whose data is not loaded is named on the page rather than fetched, because turning a layer on is the viewer's choice. A source whose read failed is named with its error instead, so a failed bushfire, air quality or gauge feed never reads as nothing there. Gauges say which publisher's feed failed when the other still loads (`gaugeNotice()`), here, beside flooding events and in the Layers panel. Story pages, outage pages and the camera card link to the locality they name.

## The dashboard and kiosk board have their own paths

`/dashboard` and `/kiosk/<region>/<stop id>` are separate full-screen views, not panels in the app. `parsePath()` in `src/lib/route.ts` picks the screen in `src/Root.tsx`, and each screen is loaded only when opened. The dashboard is a set of panels the viewer chooses and orders: `src/lib/dashboardLayout.ts` holds the registry and the layout rules, `src/dashboard/panels.tsx` and `panelsMonitor.tsx` hold one view per panel, and `Dashboard.tsx` reads only the feeds the shown panels need. The layout lives in the page link (`/dashboard?show=events,news,fires`), so a TV can be set up by URL, and otherwise in this browser. Hosts serve `index.html` for these paths: `vercel.json` and `public/_redirects` rewrite them. The dashboard's figures come from pure functions in `src/lib/dashboard.ts`. Its on-time share counts only trips with a vehicle reporting its position, because Translink's feed also lists trips that haven't started, whose delay is just the timetable.

The **creeks rising fastest** tile measures each gauge's rise over the hour before now, between two readings reported in that hour (`fastestRising()` in `src/lib/dashboard.ts`). A gauge that has stopped reporting is left out, so a rise from hours ago never shows as a rise in the last hour.

## The status page shows every feed's health and provenance

`/status` lists every feed the app reads, grouped by publisher, with its address, licence, read path, refresh cadence and code module, and the result of reading it from this browser. `src/lib/feedRegistry.ts` is the single source of truth for that list, covering the feeds in the Live feeds table in [Data sources](data-sources.md) and the built-in past cyclone tracks file; the page and its checks read it and list nothing themselves. Each map layer's info line in the layers panel (publisher and read cadence) comes from the same list through `layerInfo()` in `src/lib/layerInfo.ts`, with the latest time from the data itself (`layerTimes()`): the publisher's own time where the feed carries one, or the time the feed was read, labelled as such. `src/status/feedChecks.ts` pairs each entry with the app's own fetch function, so a feed counts as healthy only when its data parses, and marks the one feed the page cannot read on its own (camera image times, which need a pinned camera) as not checked rather than guessing. `src/status/useFeedHealth.ts` runs every check when the page opens and every two minutes after. The page shows the publisher's own time where a feed carries one (`events_v2`'s `published`, the news snapshot's `fetchedAt`, the air quality feed's measured hour) and never infers a status: "not checked" is a result in its own right.

## The API and MCP server share the app's parsing

`api/` holds the Vercel functions. The public part is four REST endpoints (`/api/events`, `/api/stops`, `/api/departures` and `/api/bushfires`) and an MCP server (`api/mcp.ts`, Streamable HTTP, stateless). The REST endpoints share one function, `api/[endpoint].ts`, with the app's own endpoints (camera times, history, share pages, visits and feedback); the news monitor, push alerts and the `/qld-gauges` proxy have files of their own. [Deploy the app](deploy.md#endpoints-that-run-only-on-vercel) lists them all. The public endpoints fetch the official feeds directly, because servers need no CORS proxy, and cache each one in memory for 30 to 120 seconds. `api/_lib/tools.ts` turns the data into answers, and both the REST endpoints and the MCP tools call it, so they always agree.

The functions reuse the app's pure modules: `src/api/gtfsrt.ts` decodes Translink's protobuf feeds, `src/api/bushfireFeed.ts` parses the bushfire feed, `src/lib/eventStatus.ts` decides whether an event is in effect, and `src/lib/departures.ts` builds departure lists. These modules must not use browser-only code such as `import.meta.env`, and their relative imports end in `.js` (see [Deploy the app](deploy.md)). `site/agents.ts` writes `/openapi.json` and `/.well-known/mcp.json`.

## Published timetables are prebuilt and loaded per route

Translink's GTFS file holds about 3.7 million stop times. That is far too much to ship, so `scripts/build-timetables.mjs` compresses it at build time into one JSON file per route in `public/timetables/`.

The format removes repetition rather than precision. Most trips on a route share a stopping pattern and the same gaps between stops, so each distinct pattern is stored once, and a trip is just a pattern, a start minute, a service and a trip number. The days each service runs are a hex bitmask over the feed's calendar window. The result is small: see [Published data built into the app](data-sources.md#published-data-built-into-the-app) for the total size. A typical route is under 1 KB. `tripsOnDay()` in `src/api/timetables.ts` decodes a file for one service day.

Times are copied from `stop_times.txt` to the minute. Arrival times are kept where they differ from departure times, because the planner needs the exact arrival to show a correct change time.

## Real-time sits on top of the timetable

Two Translink feeds overlay the timetable:

- **TripUpdates** report predicted times and delays for trips running now or starting within about 85 minutes.
- **VehiclePositions** report where each tracked vehicle is.

`liveLookup()` in `src/lib/timetable.ts` matches a timetabled trip to its TripUpdate by the trip number at the start of the GTFS trip id. A trip id repeats on every day the trip runs, so a match counts only within six hours of the timetabled time. ADDED trips are never matched: their ids can carry an older timetable version (`QR 26_27-44306` against the published `44307`) and reuse a timetabled trip's number, and an ADDED trip from the night before can stay in the feed into the next afternoon.

The app follows the Translink app's convention for delays: the scheduled time, with the reported delay beside it as `+3` or `+0`. It shows `+0` only when a vehicle is reporting its position. Without a tracked vehicle, a zero delay is a schedule, not an observation.

Departure lists lead with minutes to go, as station screens and the kiosk do, counting to the reported time. The scheduled clock time stays beside or below the countdown, and a departure an hour or more away shows its clock time instead. The stop page's time toggle switches back to clock times and is remembered in `qldt-time-format`.

## The trip page shows one run, stop by stop

Tapping a departure on a stop page, a line page, a timetable or a vehicle opens `#transit/trip/<region>/<trip id>/<route>[/<service day>]`, rendered by `TripPage` in `src/components/TripPage.tsx`. The trip id is the GTFS trip id from the real-time feed, or only its leading number for a trip picked from the timetable. The route names the timetable file to load, and the service day picks one run when the link names it. Without a day, `pickRun()` in `src/lib/trip.ts` takes the run the TripUpdates feed reports, or else the run in progress or nearest now.

`tripStops()` lists the published stops in order. For each stop it adds only what the TripUpdate reports for that stop, matched by stop id or another platform of the same station. About 450 published trip patterns call at a stop twice, mostly loops, so `alignStops()` (`src/lib/stopAlign.ts`) pairs the feed's stops with the timetable's in trip order, never further along than the feed's stop sequence allows, and gives the later visit a report it can't otherwise place, because the feed drops the stops a trip has passed. Departure boards and the planner read the same pairing through `liveLookup().stopTime()`, so a loop's departure never takes the time of its return. Stops the feed omits show the timetable alone; nothing is filled in between, and an omitted stop is never called skipped, because the feed often leaves out a trip's last stops. Where the feed's stops differ from the timetable, the page says so, stop by stop: a stop the feed marks SKIPPED is struck out as not stopping, a stop on another platform of the same station shows the feed's platform with the timetabled one beside it, and a stop the feed lists that the timetable doesn't is placed after the feed stop before it and drawn on a dashed stretch of the line. Bus diversions show up this way, for example a stop named "… CLOSED" on a route that normally misses it. A line above the stops counts the changes. A stop is marked passed only when the reporting vehicle names a later stop as its current one. A trip the timetable lacks, such as an extra service, lists the feed's own stops. The page says the trip is cancelled only when its TripUpdate has the CANCELED relationship.

## Overdue departures are stated, not judged

A stop page lists a published departure as "Due 3:15 pm · 10 min past, no vehicle reporting" when `overdueMinutes()` in `src/lib/trip.ts` finds all of these:

- its time passed within the last 30 minutes;
- no vehicle reports the trip;
- the TripUpdates feed never listed the trip while the app polled it without a break, from before the trip's timetabled start until after the due time.

The last condition matters because Translink often drops a trip's final stops from TripUpdates. In October 2026 about 30% of trips in the feed ended before their timetabled last stop, some by two hours, so a trip missing from one snapshot may simply have passed its last listed stop. The shared TripUpdates poller in `src/hooks/useTransitFeeds.ts` records every trip it sees with `watchFeed()`, and restarts the watch after a gap of more than three minutes, such as while the page was hidden. So the flag appears only for trips that start after the page began checking. Vehicle positions must have loaded too, so an outage on our side never reads as a missing vehicle. The row says what the feeds show and nothing more: it never says cancelled, because only Translink's feed can.

The poller publishes nothing until a region's TripUpdates have arrived (`mergeTripParts()` in `src/lib/tripFeed.ts`), and a stop page lists real-time departures only once its own region has been read (`regionRead()`). Until then the page shows a loader, or **Couldn't load real-time departures** if the read failed, never "No departures".

## Stop pages lead with the next service

A stop page puts its next service from Translink's real-time feed in a card of its own, with the scheduled clock time, minutes to go, route, platform and whether it is tracked. The published timetable below it splits the day into Now, AM (4am to noon), PM (noon to 7pm) and Night (7pm to 4am), using `bandOf()` in `src/lib/timeBands.ts`. A "Last" badge marks the last departure of each service day on each line to each destination, from `lastServices()`. It looks at every departure loaded for the day, including those after midnight, because a service day can run past midnight and an 11:30 pm train is not the last if the same day's timetable has a 12:15 am one.

## Saved trips re-plan from the timetable

"My trips" follows TripView: a saved from → to pair, with the planner's mode and "direct only" filters, shown on the Transit home with its next four departures. Each card runs the same `planJourneys()` as the planner over today's published trips, then `filterJourneys()` and `nextJourneys()` in `src/lib/savedTrips.ts`. A journey stays listed until both its published departure and the departure Translink reports for its first ride have passed, so a late service is not dropped early. The card copies TripView's layout: the trip edged in the colour of the line it next leaves on, and each departure with its minutes to go in a block of that line's colour, the boarding platform and published departure on the left, and the published arrival and route on the right. Each line is labelled Real-time when a vehicle on the first ride is reporting its position, and Scheduled otherwise. "On time" appears only for a tracked vehicle, and a reported delay without one reads "Scheduled · reported 3 min late". Translink service alerts on the shown routes sit under the card, and the list ends with the time of the real-time feed it used. Tapping a card opens the planner at `#transit/plan/<region>/<from>/<to>/now/now/leave/<modes>`, built by `planHash()` in `src/lib/route.ts`. The list, with each trip's name and order, is kept in `qldt-saved-trips`.

## Train lines come from two official sources that disagree

Translink's T-code mapping files each Queensland Rail route under the line it ends on. A Nambour train that runs through Caboolture is filed under T1 Nambour, not T1 Caboolture. Translink's own Caboolture timetable lists it anyway. `timetableCodes()` in `src/lib/transitLines.ts` reconciles the two by adding the train routes that call at the line's terminus and also stop at every station the line's own trains stop at. That matches Translink: T1 Caboolture lists Nambour trains, which stop everywhere from Caboolture in, but not Gympie North trains, which run express past Morayfield to Dakabin.

## The map

`src/components/TrafficMap.tsx` creates one MapLibre map and keeps it for the life of the app. Theme and base map changes swap the style. When a style loads, `addLayers()` in `src/components/map/layers.ts` re-adds every app layer, and `ready` changes so the data effects push their data again. Taps and hover labels go through one handler for the whole map rather than one per layer, so a tap opens exactly one feature: `pickTap()` in `src/lib/mapPick.ts` takes a marker over a line and a line over a filled area, then the topmost. Without that, a bushfire warning or outage area would take every tap on the markers inside it.

A road event gets a marker at every point QLDTraffic publishes for it (`eventMarkerPoints()` in `src/lib/eventAnchor.ts`), so a closure published at two flooded crossings shows both, and each opens the same event. Its lines and areas are drawn from the same geometry. An event with no points gets one marker at the middle of its first line.

Opening an item moves the map to it once. Every poll brings a fresh copy of the open event or place, so the map fits or flies only when a different id opens (`useFitEvent()` in `src/components/map/useFitEvent.ts`, `useSelectedPlace()` in `src/hooks/useSelection.ts`), as it already did for fires, gauges, signals and vehicles. A pan or zoom the user makes while an item is open stays put.

Track lines come from Translink's GTFS shapes. Those shapes follow the middle of a rail corridor, about 2 m from each rail of a double track. Storing them more precisely does not bring them closer to the rails. When zoomed in, the map draws them as a translucent band wide enough to cover the corridor, so the base map's individual rails show through.

Map animation follows the same rule as the data. The **Signal traffic** layer does not animate red, amber and green lights, because the council's feed has no phase timing. It rings intersections whose measured saturation changed in the newest batch, and it pulses a halo on intersections at 100% or more. `useSignalAnimation` in `src/components/map/` runs both, and turns them off when the viewer's system asks for reduced motion.

## Notifications run in the app; commute alerts can also be pushed

In-app notifications need no server. `useNotifications` in `src/hooks/useNotifications.ts` compares each refresh with the last one it saw, which it keeps in `localStorage`. It raises a notification for new or changed items that match the user's settings. Items that changed while the app was closed appear as "While you were away" on the next visit. Every feed is polled through `poll()` in `src/hooks/poll.ts`, which pauses while the tab is hidden and reads again as soon as it is back in view if a poll was missed. The feeds that raise alerts (road events, Translink alerts, bushfire warnings, storm, flood and cyclone warnings, and news) keep polling in a hidden tab while system notifications are on and allowed (`shouldPoll()` in `src/lib/polling.ts`), because a hidden tab is when those notifications show. Browsers may run a background tab's timers less often. The in-app and system notification switches are independent. New items alert only once the user has said where from: places (near them, roads and suburbs, or districts) or anywhere in Queensland (`alertArea()` in `src/lib/alertRules.ts`). Until then, which is how every first visit starts, only watched events and Translink routes alert, and the bell asks where (`src/components/AlertAreaPrompt.tsx`). Settings saved before this choice existed keep alerting statewide. Each event card in the list has a **Watch** button, as the event's page does.

Commute push alerts are the one exception, and riders opt in. The browser subscribes with the server's VAPID key (`src/api/push.ts`, `public/sw.js`) and sends the subscription and its commute to `api/push.ts`, which stores them in Upstash Redis. Every five minutes a GitHub Actions workflow calls `api/push-check.ts`. It checks only commutes inside their window, runs `commuteAlerts()` from `src/lib/commute.ts` (the same rules the in-app card uses) and sends each alert once. The service worker shows alerts and caches nothing. In the app, the commute card's roads line says **Checking QLDTraffic…** until the events feed has been read once, and that it couldn't load them if the first read failed (`roadsBriefing()`), so an unknown never reads as "Nothing reported".

## The news monitor reads feeds on the server

The **News** tab follows the same rule as everything else: it shows what publishers published, and estimates nothing. `api/news-ingest.ts` reads ABC, 7NEWS, Brisbane Times, Guardian Australia and SBS RSS feeds, Queensland Police media releases and Geoscience Australia earthquakes every 5 minutes, and stores the last 48 hours in Upstash Redis. It keeps only each item's headline, link, publisher, date and the first sentence of its summary. `api/news.ts` serves them; without a store it reads the feeds itself, at most once per 5 minutes per warm function.

The pure parts sit where they always do. `src/api/newsFeeds.ts` parses RSS, the BoM's AMOC files and GA's WFS. `src/lib/newsItems.ts` cuts items down and merges runs, `src/lib/newsPlaces.ts` matches place names, and `src/lib/newsStories.ts` groups reports into stories and filters them. The browser groups stories itself, so the News tab, the map, the dashboard strip and news alerts all use one function.

A story is placed only where its stored headline or summary names a place in Queensland's place names gazetteer, exactly. When the text also names a road in that place, the server draws that road's segments there from the state's roads dataset (`src/api/qldRoads.ts`, `src/lib/newsRoads.ts`).

The same run reads 58 council disaster dashboards (`src/api/councilDashboard.ts`): their bulletins join the news items as official reports, and the centres, cameras, Energex outages and notices they list go into the same snapshot for the **Council centres**, camera and **Outages and council notices** map layers (`src/lib/councilCentres.ts`, `src/lib/councilCameras.ts`, `src/lib/outages.ts`). A story's pin sits at the gazetteer point of the place it names, not where the reported incident happened, because no feed publishes that. Each story says which name placed it. Reports are grouped only by shared headline words within 12 hours, and a story counts outlets, not truth: nothing is labelled verified, and official items are never grouped with news. See [Data sources](data-sources.md#news-monitor-feeds) for the feeds, their terms and the matching rules.

## The timeline replays what was published, not what happened

The **Replay** bar on the map, and the **Replay the last 48 hours** dashboard panel, scrub back over the last 48 hours. The same rule holds as everywhere else: a replay shows only what a source had published by the chosen time, each item at its publisher's own time, and nothing is interpolated. News items are shown once their publisher's date has passed, and council gauges show only the readings taken by then (`src/lib/timeline.ts`, `replayAt()`). Every other layer stays live, and a banner says the view is not.

QLDTraffic publishes only the present, so the server keeps the only record of the past. The news monitor's 5-minute run (`api/news-ingest.ts`) also reads the events feed and records which events were in effect, as the official site counts them, under one Redis key (`api/_lib/eventHistoryStore.ts`). The record is compact: one row per read (`runs`, with the feed's own `published` stamp and a count) and one row per published version of an event (`events`, keyed by id and `last_updated`), holding only its times, type, priority, closure flag, anchor point and road, plus the runs it was seen at as `[first, last]` pairs. A version is never extended past a read that did not include it. `src/api/historyTypes.ts` defines the shape and `src/lib/eventHistory.ts` merges a read in and prunes to 48 hours, 600 reads and 900 KB. `/api/history` (`api/_lib/endpoints/history.ts`) serves it, and records a read itself if the stored record is 15 minutes old; without a store it serves what the warm function has read since it started, and says so.

A replay shows events as of the nearest read at or before the chosen time, never a later one and never a guess between reads, and the bar names that read: "as of the 10:35 read, the last before 10:40". A time before the record starts shows no events, and says that too.

## Speed and red light cameras come from the state's own map

The **Speed and red light cameras** layer reads the camera map that qld.gov.au links to, which Google My Maps serves as KML with `Access-Control-Allow-Origin: *`. `src/api/speedCameras.ts` fetches and parses it, `src/components/map/speedCameraLayers.ts` draws each site at its published point, and `src/components/SpeedCameraParts.tsx` renders the layer note and a site's page. A point-to-point section is drawn as its two published sites with no line between them, because the map publishes none. Mobile camera sites have only a road and suburb, so they are linked, not mapped.

## Saved places count what QLDTraffic reports near them

"My places" keeps localities a visitor saves with their own nickname (`src/lib/savedPlaces.ts`). `placeSummary()` counts the current road events, and the closures among them, whose published point is within 5 km of the gazetteer point. `MyPlaces` in `src/components/MyPlaces.tsx` lists them above the road events, and `SavePlace` on the locality page adds one. The list stays in this browser.

## The map key lists only what is on the map

The **Key** button opens `MapKey` (`src/components/map/MapKey.tsx`). `mapKeySections()` in `src/lib/mapKey.ts` lists road events, which are always shown, then a section for each switched-on layer that draws icons or coloured dots, labelled with the source's own words.

## A saved map image says where and when it came from

**Save image** in `src/components/map/MapTools.tsx` draws the map and a footer into one PNG (`src/components/map/drawMapImage.ts`). `imageFooter()` in `src/lib/mapImage.ts` writes the footer: the save time in AEST, each shown source's latest data time where Roadbeat knows it, the key, the map credits, and anything on screen the picture leaves out. The rain radar image doesn't allow its pixels to be copied, so it is left out and the footer says so. On a phone the image goes to the share sheet; elsewhere it downloads. The image is made in the browser and never sent anywhere.

## The crosshair reads only what the map draws

The crosshair, also in `src/components/map/MapTools.tsx`, shows the map centre's coordinates and the labelled official items drawn under it (`formatPosition()` and `crosshairItems()` in `src/lib/crosshair.ts`). It computes nothing for the point itself, such as a model wind or an elevation.

## Feedback goes to Roadbeat's own server

**Send feedback** in the app's menu opens `FeedbackDialog` (`src/components/FeedbackDialog.tsx`), which posts through `src/api/feedback.ts` to `/api/feedback` (`api/_lib/endpoints/feedback.ts`). `api/_lib/feedback.ts` validates the message and decides what is kept: what the person typed, its kind, the page and the time, and an email only if they give one. Messages go into a capped Redis list. See [Turn on feedback](deploy.md#turn-on-feedback).

## What the browser remembers

Preferences live in `localStorage`, so they stay in one browser and never reach a server. The one exception is the commute, which is also sent to the server if push alerts are turned on (see above).

| Key | Holds |
| --- | --- |
| `qldt-alert-settings` | Notification settings |
| `qldt-notifications`, `qldt-seen` | The notification list and the last state seen |
| `qldt-saved-stops`, `qldt-recent-stops`, `qldt-saved-trips` | My stops, Recent stops and My trips |
| `qldt-saved-places` | My places, with their nicknames |
| `qldt-recent-searches` | The last six results opened from the header search |
| `qldt-fuel-brands` | The brands the fuel layer is narrowed to, empty for all |
| `roadbeat-commute` | My commute: roads, stop, line, departure time and days |
| `qldt-mode` | Light or dark colour theme |
| `qldt-basemap` | Street map style |
| `qldt-base`, `qldt-satellite` | Street map or satellite, and the satellite image chosen |
| `qldt-satellite-dismissed` | Storms and warnings whose satellite suggestion was dismissed |
| `qldt-panel`, `qldt-time-format` | Panel size and departure time format |
| `qldt-dashboard` | Which dashboard panels show, in what order |

`sessionStorage` holds one key, `qldt-transit-tab`, the Transit tab last open, which is forgotten when the tab closes.
