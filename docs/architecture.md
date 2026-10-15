# Architecture

This page explains how Roadbeat is put together and why. For the list of feeds, see [Data sources](data-sources.md).

## The rule behind every design decision

The app shows only what an official source publishes. It does not interpolate a time between two published stops, place a vehicle between two GPS reports, or guess a walking time. When a feature would need an estimate, the app either leaves the feature out or hands the user to the official tool that owns the estimate.

Some of the choices below look odd until you know this rule. The journey planner changes only at the same station, because a change between two stops needs a walking time, and no source publishes one. A vehicle slides to a new position for one second after a report arrives and then stops, because anything longer would show a position nobody reported.

## The app is a static site with three small proxies

The browser does almost all of the work. `npm run build` produces a static site in `dist/` that any static host can serve.

Most sources send `Access-Control-Allow-Origin: *`, so the browser reads them directly. Two do not:

- TransLink's GTFS-RT feeds, read through `/translink-rt`.
- The Queensland Fire Department bushfire feed, read through `/qfd-bushfires`.

Brisbane City Council's gauge and signal feeds also send `Access-Control-Allow-Origin: *`, so the browser reads them directly.

In development, `vite.config.ts` proxies both paths. In production, a Cloudflare Pages Function in `functions/` proxies each one and caches the response at the edge. `vercel.json` does the same on Vercel. Without a proxy, the app still runs: live vehicles and bushfire warnings show as unavailable.

## Code layout

```
src/
  api/          one module per source: fetch, parse into domain types, nothing else
  lib/          pure logic: filters, the journey planner, timetable grids, alert rules
  hooks/        polling and shared state (React hooks)
  components/   screens and panels; map/ holds the MapLibre layers and overlays
  data/         static JSON built from TransLink's GTFS by scripts/
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

## Navigation lives in the URL hash

Every page has a hash route, so any view can be shared or bookmarked: `#event/123`, `#fire/WARN-10208`, `#transit/stop/SEQ/place_censta`, `#transit/plan/SEQ/place_fersta/place_dbnsta`. `readHash()` in `src/App.tsx` parses the hash into a selection, and the side panel renders whatever is selected. There is no router library, because the app has one screen with a side panel and a map.

## The dashboard and kiosk board have their own paths

`/dashboard` and `/kiosk/<region>/<stop id>` are separate full-screen views, not panels in the app. `parsePath()` in `src/lib/route.ts` picks the screen in `src/Root.tsx`, and each screen is loaded only when opened. Hosts serve `index.html` for these paths: `vercel.json` and `public/_redirects` rewrite them. The dashboard's figures come from pure functions in `src/lib/dashboard.ts`. Its on-time share counts only trips with a vehicle reporting its position, because TransLink's feed also lists trips that haven't started, whose delay is just the timetable.

## Published timetables are prebuilt and loaded per route

TransLink's GTFS file holds about 3.7 million stop times. That is far too much to ship, so `scripts/build-timetables.mjs` compresses it at build time into one JSON file per route in `public/timetables/`.

The format removes repetition rather than precision. Most trips on a route share a stopping pattern and the same gaps between stops, so each distinct pattern is stored once, and a trip is just a pattern, a start minute, a service and a trip number. The days each service runs are a hex bitmask over the feed's calendar window. The result is about 1.1 MB compressed for every trip in the state, with a typical route under 1 KB. `tripsOnDay()` in `src/api/timetables.ts` decodes a file for one service day.

Times are copied from `stop_times.txt` to the minute. Arrival times are kept where they differ from departure times, because the planner needs the exact arrival to show a correct change time.

## Real-time sits on top of the timetable

Two TransLink feeds overlay the timetable:

- **TripUpdates** report predicted times and delays for trips running now or starting within about 85 minutes.
- **VehiclePositions** report where each tracked vehicle is.

`liveLookup()` in `src/lib/timetable.ts` matches a timetabled trip to its TripUpdate by the trip number at the start of the GTFS trip id. A trip id repeats on every day the trip runs, so a match counts only within six hours of the timetabled time.

The app follows the TransLink app's convention for delays: the scheduled time, with the reported delay beside it as `+3` or `+0`. It shows `+0` only when a vehicle is reporting its position. Without a tracked vehicle, a zero delay is a schedule, not an observation.

## Train lines come from two official sources that disagree

TransLink's T-code mapping files each Queensland Rail route under the line it ends on. A Nambour train that runs through Caboolture is filed under T1 Nambour, not T1 Caboolture. TransLink's own Caboolture timetable lists it anyway. `timetableCodes()` in `src/lib/transitLines.ts` reconciles the two by adding every train route that calls at the line's terminus.

## The map

`src/components/TrafficMap.tsx` creates one MapLibre map and keeps it for the life of the app. Theme and base map changes swap the style. When a style loads, `addLayers()` in `src/components/map/layers.ts` re-adds every app layer, and `ready` changes so the data effects push their data again.

Track lines come from TransLink's GTFS shapes. Those shapes follow the middle of a rail corridor, about 2 m from each rail of a double track. Storing them more precisely does not bring them closer to the rails. When zoomed in, the map draws them as a translucent band wide enough to cover the corridor, so the base map's individual rails show through.

Map animation follows the same rule as the data. The **Signal traffic** layer does not animate red, amber and green lights, because the council's feed has no phase timing. It rings intersections whose measured saturation changed in the newest batch, and it pulses a halo on intersections at 100% or more. `useSignalAnimation` in `src/components/map/` runs both, and turns them off when the viewer's system asks for reduced motion.

## Notifications run only while the app is open

There is no push server. `useNotifications` in `src/hooks/useNotifications.ts` compares each refresh with the last one it saw, which it keeps in `localStorage`. It raises a notification for new or changed items that match the user's settings. Items that changed while the app was closed appear as "While you were away" on the next visit.

## What the browser remembers

Preferences live in `localStorage`, so they stay in one browser and never reach a server.

| Key | Holds |
| --- | --- |
| `qldt-alert-settings` | Notification settings |
| `qldt-notifications`, `qldt-seen` | The notification list and the last state seen |
| `qldt-saved-stops`, `qldt-recent-stops`, `qldt-saved-trips` | My stops, Recent stops and My trips |
| `qldt-panel`, `qldt-basemap`, `qldt-time-format` | Panel size, base map style and departure time format |
