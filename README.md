# Roadbeat

[Roadbeat](https://www.roadbeat.app) is a free web app for Queensland's live road conditions and public transport. It shows the official QLDTraffic road events, traffic cameras, Translink buses, trains, trams and ferries, published timetables, a journey planner, and Queensland Fire Department bushfire warnings on one map.

The app shows only data that an official source publishes. It never estimates a time, a position, or a delay. Where a source has a gap, the app says so instead of filling it.

It is built with React 19, [Kumo](https://kumo-ui.com/) (Cloudflare's component library), MapLibre GL and Vite.

## What it does

- **Road events.** Crashes, hazards, flooding, congestion, roadworks and closures from QLDTraffic, refreshed every 60 seconds, plus traffic and flood cameras.
- **Live transport.** Translink vehicle positions, departures and service alerts, with the published timetable for every route in the state.
- **Journey planner and My trips.** Direct trips and trips with one change at the same station or stop, from the published timetable, and saved trips that count down to their next departures.
- **Hazard warnings.** Queensland Fire Department bushfire warnings and fire bans, and Queensland's storm, flood and cyclone warnings, each as published.
- **Gauges, air quality and satellite.** Brisbane City Council and Queensland Government stream gauges, the state's air quality stations, satellite hotspots and Himawari-9 imagery.
- **News and council reports.** Queensland police, council disaster dashboards and news headlines on one map, each linked to its publisher.
- **My commute.** Your roads, stop and line in one card before you leave, with optional push alerts.
- **Network dashboard and kiosk board.** A full-screen overview at `/dashboard` and a departure board for one stop at `/kiosk/<region>/<stop id>`.
- **API and MCP server.** Free, read-only answers for AI agents and apps at `/api/*` and `/mcp`, described in `/openapi.json` and `/llms.txt`.

For everything else, see the [About page](https://www.roadbeat.app/about/) and [Data sources](docs/data-sources.md). Roadbeat counts visitors without cookies, and Vercel Web Analytics counts page views in Roadbeat's Vercel dashboard (see [Privacy](site/pages/privacy.md)).

## Support

Roadbeat is free, with no ads or accounts. If it's useful to you, you can support it at [Buy Me a Coffee](https://buymeacoffee.com/realbakari).

## Run it locally

You need Node.js 22 or later (the version in `.nvmrc`), and `unzip` if you run the data build scripts.

1. Get the code:

   ```bash
   git clone https://github.com/realbakari/Roadbeat.git
   cd Roadbeat
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open the URL that Vite prints, usually http://localhost:5173.

The development server proxies the feeds that send no CORS headers (see [Deploy the app](docs/deploy.md)), so live transport and the hazard warnings work locally.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the Vite development server with the feed proxies. |
| `npm run build` | Builds the static site into `dist/`. |
| `npm run preview` | Serves the built site with the same proxies as `dev`. |
| `npm test` | Runs the unit tests once with Vitest. |
| `npm run lint` | Lints the project with oxlint. |
| `npm run typecheck` | Type-checks the app, the build configs, `api/` with its tests, and `functions/`. |

The `npm run data:*` scripts rebuild the published data in `src/data/` and `public/`. See [Refresh the published data](docs/refresh-data.md).

## Bugs and ideas

Report a bug or suggest a feature in [GitHub Issues](https://github.com/realbakari/Roadbeat/issues), or use **Send feedback** in the app's menu. Report security problems privately, as [SECURITY.md](SECURITY.md) describes. To change the code, see [Contributing](docs/contributing.md).

## Documentation

- [Architecture](docs/architecture.md) explains how the app is put together and why.
- [Data sources](docs/data-sources.md) lists every feed and dataset, where it comes from, how often it changes, and its licence.
- [Refresh the published data](docs/refresh-data.md) shows how to rebuild the timetables, stops, tracks and maps when Translink publishes new ones.
- [Deploy the app](docs/deploy.md) covers static hosting and the feed proxies.
- [Contributing](docs/contributing.md) sets out the code conventions, the accuracy rule and how to test a change.

Roadbeat also publishes [About](site/pages/about.md), [Privacy](site/pages/privacy.md) and [Contact](site/pages/contact.md) pages, and an [`llms.txt`](site/llms.txt) for AI agents.

## Licence

The code is released under the MIT licence (see [LICENSE](LICENSE)).

Road and transport data © State of Queensland (Department of Transport and Main Roads, Translink, Queensland Fire Department, Department of Local Government, Water and Volunteers) and Brisbane City Council, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Base maps © OpenFreeMap, OpenMapTiles and OpenStreetMap contributors. Other sources carry their own terms, listed in [Data sources](docs/data-sources.md). This is an independent project and is not affiliated with the Queensland Government.
