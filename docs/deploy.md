# Deploy the app

`npm run build` writes a static site to `dist/`. Any static host can serve it. Live transport, bushfire warnings, Queensland's severe weather, flood and cyclone warnings, the statewide stream gauges and air quality also need proxies, because their sources send no CORS headers. Everything else works without them.

| Path | Proxies |
| --- | --- |
| `/translink-rt/<region>/<feed>` | `https://gtfsrt.api.translink.com.au/api/realtime/<region>/<feed>` |
| `/qfd-bushfires` | `https://publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com/content/Feeds/BushfireCurrentIncidents/bushfireAlert.json` |
| `/qld-warnings` | `https://publiccontent-qld-alerts.s3.ap-southeast-2.amazonaws.com/content/Feeds/StormFloodCycloneWarnings/StormWarnings.json` |
| `/air-quality` | `https://apps.des.qld.gov.au/air-quality/xml/feed.php?category=1&region=ALL` |
| `/qld-gauges` | A POST to `https://water-monitoring.information.qld.gov.au/cgi/webservice.pl` for the latest stream height at every station in `public/qld-gauges.json` |

Without the proxies, the Transit tab falls back to TransLink's RSS notices, the bushfire, Queensland warnings and air quality layers stay empty, and the gauges layer shows Brisbane City Council's gauges only.

## Set the site address and contact email

Three build settings feed the pages that search engines and AI agents read. Set them as environment variables on your host, or in a `.env` file locally:

| Variable | Example | What it sets |
| --- | --- | --- |
| `SITE_URL` | `https://www.roadbeat.app` | Canonical links, Open Graph URLs, `sitemap.xml` and the absolute links in `llms.txt`. Without it, those are left out. |
| `CONTACT_EMAIL` | `hello@roadbeat.com.au` | The address on the Contact page and the contact point in the JSON-LD. Without it, the Contact page says an address is coming soon. |
| `GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` | Adds the Google Analytics tag to every page and the Analytics section to the Privacy page. Used only by `npm run build`, so local development isn't counted. Without it, there are no analytics and the Privacy page says so. |

Rebuild after you change any of them, because both are written into the built files.

## Deploy to Cloudflare Pages

Cloudflare Pages runs the functions in `functions/` with no extra setup.

1. Set the build command to `npm run build` and the output folder to `dist`.
2. Add `SITE_URL`, `CONTACT_EMAIL` and `GA_MEASUREMENT_ID` under **Settings** > **Environment variables**.
3. Deploy. `functions/translink-rt/[[path]].ts`, `functions/qfd-bushfires.ts`, `functions/qld-warnings.ts`, `functions/air-quality.ts` and `functions/qld-gauges.ts` serve the proxy paths and cache each response at the edge for 10 to 60 seconds. `functions/_middleware.ts` returns each page as Markdown when a request sends `Accept: text/markdown`, and a Markdown 404 for unknown pages.

## Deploy to Vercel

`vercel.json` sets the build command and output folder, rewrites the proxy paths, redirects `/about`, `/stations/<slug>` and the like, and `/index.html`, to the address with the trailing slash that the canonical links use, caches the content-hashed files in `/assets/` for a year as immutable, marks the `.md` twins `X-Robots-Tag: noindex` so search engines index only the HTML pages, and gives `api/qld-gauges.ts` 60 seconds, because the water monitoring portal takes about 20 seconds to answer. `middleware.ts` returns each page as Markdown when a request sends `Accept: text/markdown`, the same as `functions/_middleware.ts` on Cloudflare. Add `SITE_URL`, `CONTACT_EMAIL` and `GA_MEASUREMENT_ID` as environment variables. Until `SITE_URL` is set, the build uses the project's production address (`VERCEL_PROJECT_PRODUCTION_URL`).

### The API and MCP server run only on Vercel

The functions in `api/` serve the public API (`/api/events`, `/api/stops`, `/api/departures`, `/api/bushfires`), the news monitor (`/api/news`), camera image times (`/api/camera-time`, also `functions/camera-time.ts` on Cloudflare) and the MCP server at `/mcp`. Vercel builds them with no extra setup. On other hosts the app still works; only these endpoints are missing.

Vercel's Hobby plan deploys at most 12 functions, and every file directly in `api/` is one, as is `middleware.ts`. So the small read-only endpoints (`/api/events`, `/api/stops`, `/api/departures`, `/api/bushfires`, `/api/history`, `/api/camera-time`, `/api/share` and `/api/visits`) share one function, `api/[endpoint].ts`, which routes by path to handlers in `api/_lib/endpoints/`. Add a new small endpoint there rather than as a new file in `api/`; Vercel doesn't deploy files under `api/_lib/` as functions. The deployment currently has 8 functions.

Vercel compiles each file in `api/` on its own for Node, without bundling. So every relative import in `api/`, and in the `src/` modules it imports, must end in `.js`, and JSON imports need `with { type: 'json' }`. `api/tsconfig.json` checks this, and `npm run build` runs it.

### Count visitors

Two counts run, and both are off until set up:

- **Vercel Web Analytics** shows visitors, page views, countries, devices and referrers in the Vercel dashboard. The app includes Vercel's `<Analytics />` component (`src/main.tsx`), which does nothing until you open the project in Vercel, choose **Analytics** and click **Enable**; redeploy after enabling. It sets no cookies. The Hobby plan counts 50,000 events a month.
- **Feedback** from the app's menu goes to `/api/feedback` (`api/_lib/endpoints/feedback.ts`) and needs the same Upstash database. Messages are kept in the Redis list `feedback`, newest first, capped at 2,000, and each browser may send 5 a day. To read them, run `curl -H "Authorization: Bearer $CRON_SECRET" https://www.roadbeat.app/api/feedback`, or open the list in the Upstash console. Without the database, the form says feedback isn't set up.
- **The visitor count in the app's header** ("14 online · 312 today") comes from `/api/visits` (`api/_lib/endpoints/visits.ts`) and needs the Upstash for Redis database, connected as for push alerts. Each open tab pings every five minutes and is counted under a daily-rotating hash of its address and browser (`api/_lib/visits.ts`), in HyperLogLogs that keep an estimate, not the ids. Set `VISITS_SALT` to a long random string so the hash can't be recomputed by anyone without it; without it, `CRON_SECRET` is used. Without the database, the endpoint answers `{ "available": false }` and the header shows no count.

The count costs four Redis commands per open tab every five minutes, about 1,150 a day for a tab left open all day. Upstash's free tier allows 500,000 commands a month, so the count stays free up to roughly 14 tabs open around the clock, or many more briefly; past that, upgrade the database or lengthen the ping in `src/hooks/useVisitors.ts`.

### Turn on commute push alerts

Push alerts need four environment variables, a database and a scheduler. Until all are set, the app hides the push switch and everything else works.

1. Generate VAPID keys with `npx web-push generate-vapid-keys`. In Vercel, set `VAPID_PUBLIC_KEY` and `VITE_VAPID_PUBLIC_KEY` to the public key, and `VAPID_PRIVATE_KEY` to the private key as a sensitive variable. Optionally set `VAPID_SUBJECT` to a `mailto:` address; it defaults to the site address.
2. Set `CRON_SECRET` to a long random string, as a sensitive variable.
3. In Vercel, open **Storage**, create an **Upstash for Redis** database and connect it to the project. This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
4. In GitHub, add a repository secret named `CRON_SECRET` with the same value. `.github/workflows/push-check.yml` then calls `/api/push-check` every 5 minutes. The workflow reads the site's address from the repository variable `SITE_URL` (set to `https://www.roadbeat.app`).
5. Redeploy, so the build picks up `VITE_VAPID_PUBLIC_KEY`.

GitHub runs scheduled workflows on a best-effort basis, often a few minutes late, and pauses them in repositories with no activity for 60 days. Vercel's Hobby plan runs its own cron jobs only once a day, which is why GitHub does the scheduling.

### Turn on the news monitor

The **News** tab works on Vercel with no setup: `/api/news` reads the feeds itself when a request finds no stored copy, at most once per 5 minutes per warm function. For steadier updates, and to share one copy between functions:

1. Connect the Upstash for Redis database, as for push alerts. The monitor stores its items under one key, `news:snapshot`.
2. Set `CRON_SECRET` in Vercel and as a GitHub repository secret, as for push alerts. `.github/workflows/news-ingest.yml` then calls `/api/news-ingest` every 5 minutes. If the scheduler stops, `/api/news` reads the feeds itself once the stored copy is 15 minutes old.
3. Leave `NEWS_BOM_WARNINGS` unset unless you have the Bureau of Meteorology's permission to publish its warnings. Set it to `on` to add Queensland warning headlines from the BoM's anonymous FTP server (see [Data sources](data-sources.md#news-monitor-feeds)).

The same run records the road event history for the app's timeline under a second key, `events:history`. It holds the last 48 hours of 5-minute reads of the events feed (at most 600 reads) and is capped at 900 KB: `src/lib/eventHistory.ts` drops the oldest reads first when the cap is reached. Without the store, `/api/history` serves only what that warm function has read since it started, and the timeline says so.

`npm run dev` serves `/api/news` from `vite.config.ts`, reading the feeds on your machine. `npm run news:ingest` reads every feed once and prints what each one gave. On other hosts, port `api/news.ts` to a function, or point `VITE_NEWS_URL` at a Roadbeat deployment that has one; without it the News tab says it couldn't load.

## Deploy to Netlify

Add the rewrites to `public/_redirects` before you build:

```
/translink-rt/*  https://gtfsrt.api.translink.com.au/api/realtime/:splat  200
/qfd-bushfires   https://publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com/content/Feeds/BushfireCurrentIncidents/bushfireAlert.json  200
/qld-warnings    https://publiccontent-qld-alerts.s3.ap-southeast-2.amazonaws.com/content/Feeds/StormFloodCycloneWarnings/StormWarnings.json  200
/air-quality     https://apps.des.qld.gov.au/air-quality/xml/feed.php?category=1&region=ALL  200
```

A rewrite can't serve `/qld-gauges`, because the water monitoring portal wants a POST. Port `functions/qld-gauges.ts` to a Netlify Function, or leave it out: the map then shows Brisbane City Council's gauges only.

## Deploy elsewhere

On any other host, serve `dist/` and add a reverse proxy for the four rewrite paths in the table, and a small function for `/qld-gauges` that POSTs the request in `src/api/qldGaugesFeed.ts` to the water monitoring portal. If the proxies run on another origin, point the app at them at build time:

```bash
VITE_TRANSLINK_RT_BASE=https://proxy.example.com/translink-rt VITE_QFD_BUSHFIRES_URL=https://proxy.example.com/qfd-bushfires VITE_QLD_WARNINGS_URL=https://proxy.example.com/qld-warnings VITE_AIR_QUALITY_URL=https://proxy.example.com/air-quality VITE_QLD_GAUGES_URL=https://proxy.example.com/qld-gauges npm run build
```

## Check search and agent readiness

After the site is live at its `SITE_URL`, score it with [Is Agentic](https://is-agentic.com):

```bash
npx is-agentic roadbeat.com.au --json
```

Fix any `essential` issues first, then `recommended` ones. Reports are cached for 6 hours, so check `scanned_at` before you judge a fix. To check the pages search engines see, open `/robots.txt`, `/sitemap.xml` and `/llms.txt` on the live site.

## Check a deployment

Open the deployed site and check these three things:

- The **Transit** tab shows **Next departures** on a line page. If it shows "Couldn't load real-time departures", the `/translink-rt` proxy is missing.
- The **Road events** list shows a bushfire summary row when Queensland Fire Department has current incidents. If not, open `/qfd-bushfires` in the browser. It should return JSON.
- A line page shows its **Timetable**. If it says the published timetable isn't available, `public/timetables/` didn't deploy.
