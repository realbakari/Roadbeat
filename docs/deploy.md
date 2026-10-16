# Deploy the app

`npm run build` writes a static site to `dist/`. Any static host can serve it. Live transport, bushfire warnings, the statewide stream gauges and air quality also need proxies, because their sources send no CORS headers. Everything else works without them.

| Path | Proxies |
| --- | --- |
| `/translink-rt/<region>/<feed>` | `https://gtfsrt.api.translink.com.au/api/realtime/<region>/<feed>` |
| `/qfd-bushfires` | `https://publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com/content/Feeds/BushfireCurrentIncidents/bushfireAlert.json` |
| `/air-quality` | `https://apps.des.qld.gov.au/air-quality/xml/feed.php?category=1&region=ALL` |
| `/qld-gauges` | A POST to `https://water-monitoring.information.qld.gov.au/cgi/webservice.pl` for the latest stream height at every station in `public/qld-gauges.json` |

Without the proxies, the Transit tab falls back to TransLink's RSS notices, the bushfire and air quality layers stay empty, and the gauges layer shows Brisbane City Council's gauges only.

## Set the site address and contact email

Three build settings feed the pages that search engines and AI agents read. Set them as environment variables on your host, or in a `.env` file locally:

| Variable | Example | What it sets |
| --- | --- | --- |
| `SITE_URL` | `https://roadbeat.com.au` | Canonical links, Open Graph URLs, `sitemap.xml` and the absolute links in `llms.txt`. Without it, those are left out. |
| `CONTACT_EMAIL` | `hello@roadbeat.com.au` | The address on the Contact page and the contact point in the JSON-LD. Without it, the Contact page says an address is coming soon. |
| `GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` | Adds the Google Analytics tag to every page and the Analytics section to the Privacy page. Used only by `npm run build`, so local development isn't counted. Without it, there are no analytics and the Privacy page says so. |

Rebuild after you change any of them, because both are written into the built files.

## Deploy to Cloudflare Pages

Cloudflare Pages runs the functions in `functions/` with no extra setup.

1. Set the build command to `npm run build` and the output folder to `dist`.
2. Add `SITE_URL`, `CONTACT_EMAIL` and `GA_MEASUREMENT_ID` under **Settings** > **Environment variables**.
3. Deploy. `functions/translink-rt/[[path]].ts`, `functions/qfd-bushfires.ts`, `functions/air-quality.ts` and `functions/qld-gauges.ts` serve the proxy paths and cache each response at the edge for 10 to 60 seconds. `functions/_middleware.ts` returns each page as Markdown when a request sends `Accept: text/markdown`, and a Markdown 404 for unknown pages.

## Deploy to Vercel

`vercel.json` sets the build command and output folder, rewrites the proxy paths, and gives `api/qld-gauges.ts` 60 seconds, because the water monitoring portal takes about 20 seconds to answer. `middleware.ts` returns each page as Markdown when a request sends `Accept: text/markdown`, the same as `functions/_middleware.ts` on Cloudflare. Add `SITE_URL`, `CONTACT_EMAIL` and `GA_MEASUREMENT_ID` as environment variables. Until `SITE_URL` is set, the build uses the project's production address (`VERCEL_PROJECT_PRODUCTION_URL`).

### The API and MCP server run only on Vercel

The functions in `api/` serve the public API (`/api/events`, `/api/stops`, `/api/departures`, `/api/bushfires`) and the MCP server at `/mcp`. Vercel builds them with no extra setup. On other hosts the app still works; only these endpoints are missing.

Vercel compiles each file in `api/` on its own for Node, without bundling. So every relative import in `api/`, and in the `src/` modules it imports, must end in `.js`, and JSON imports need `with { type: 'json' }`. `api/tsconfig.json` checks this, and `npm run build` runs it.

### Turn on commute push alerts

Push alerts need four environment variables, a database and a scheduler. Until all are set, the app hides the push switch and everything else works.

1. Generate VAPID keys with `npx web-push generate-vapid-keys`. In Vercel, set `VAPID_PUBLIC_KEY` and `VITE_VAPID_PUBLIC_KEY` to the public key, and `VAPID_PRIVATE_KEY` to the private key as a sensitive variable. Optionally set `VAPID_SUBJECT` to a `mailto:` address; it defaults to the site address.
2. Set `CRON_SECRET` to a long random string, as a sensitive variable.
3. In Vercel, open **Storage**, create an **Upstash for Redis** database and connect it to the project. This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
4. In GitHub, add a repository secret named `CRON_SECRET` with the same value. `.github/workflows/push-check.yml` then calls `/api/push-check` every 5 minutes. If the site isn't at `https://roadbeat.vercel.app`, add a repository variable `SITE_URL`.
5. Redeploy, so the build picks up `VITE_VAPID_PUBLIC_KEY`.

GitHub runs scheduled workflows on a best-effort basis, often a few minutes late, and pauses them in repositories with no activity for 60 days. Vercel's Hobby plan runs its own cron jobs only once a day, which is why GitHub does the scheduling.

### Turn on the news monitor

The **News** tab works on Vercel with no setup: `/api/news` reads the feeds itself when a request finds no stored copy, at most once per 5 minutes per warm function. For steadier updates, and to share one copy between functions:

1. Connect the Upstash for Redis database, as for push alerts. The monitor stores one key, `news:snapshot`.
2. Set `CRON_SECRET` in Vercel and as a GitHub repository secret, as for push alerts. `.github/workflows/news-ingest.yml` then calls `/api/news-ingest` every 5 minutes. If the scheduler stops, `/api/news` reads the feeds itself once the stored copy is 15 minutes old.
3. Leave `NEWS_BOM_WARNINGS` unset unless you have the Bureau of Meteorology's permission to publish its warnings. Set it to `on` to add Queensland warning headlines from the BoM's anonymous FTP server (see [Data sources](data-sources.md#news-monitor-feeds)).

`npm run dev` serves `/api/news` from `vite.config.ts`, reading the feeds on your machine. `npm run news:ingest` reads every feed once and prints what each one gave. On other hosts, port `api/news.ts` to a function, or point `VITE_NEWS_URL` at a Roadbeat deployment that has one; without it the News tab says it couldn't load.

## Deploy to Netlify

Add the rewrites to `public/_redirects` before you build:

```
/translink-rt/*  https://gtfsrt.api.translink.com.au/api/realtime/:splat  200
/qfd-bushfires   https://publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com/content/Feeds/BushfireCurrentIncidents/bushfireAlert.json  200
/air-quality     https://apps.des.qld.gov.au/air-quality/xml/feed.php?category=1&region=ALL  200
```

A rewrite can't serve `/qld-gauges`, because the water monitoring portal wants a POST. Port `functions/qld-gauges.ts` to a Netlify Function, or leave it out: the map then shows Brisbane City Council's gauges only.

## Deploy elsewhere

On any other host, serve `dist/` and add a reverse proxy for the three rewrite paths in the table, and a small function for `/qld-gauges` that POSTs the request in `src/api/qldGaugesFeed.ts` to the water monitoring portal. If the proxies run on another origin, point the app at them at build time:

```bash
VITE_TRANSLINK_RT_BASE=https://proxy.example.com/translink-rt VITE_QFD_BUSHFIRES_URL=https://proxy.example.com/qfd-bushfires VITE_AIR_QUALITY_URL=https://proxy.example.com/air-quality VITE_QLD_GAUGES_URL=https://proxy.example.com/qld-gauges npm run build
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
