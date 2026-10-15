# Deploy the app

`npm run build` writes a static site to `dist/`. Any static host can serve it. Live transport and bushfire warnings also need two proxies, because their sources send no CORS headers. Everything else works without them.

| Path | Proxies |
| --- | --- |
| `/translink-rt/<region>/<feed>` | `https://gtfsrt.api.translink.com.au/api/realtime/<region>/<feed>` |
| `/qfd-bushfires` | `https://publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com/content/Feeds/BushfireCurrentIncidents/bushfireAlert.json` |

Without the proxies, the Transit tab falls back to TransLink's RSS notices, and the bushfire layer stays empty.

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
3. Deploy. `functions/translink-rt/[[path]].ts` and `functions/qfd-bushfires.ts` serve the two proxy paths and cache each response at the edge for 10 to 60 seconds. `functions/_middleware.ts` returns each page as Markdown when a request sends `Accept: text/markdown`, and a Markdown 404 for unknown pages.

## Deploy to Vercel

`vercel.json` sets the build command and output folder, and rewrites both proxy paths. `middleware.ts` returns each page as Markdown when a request sends `Accept: text/markdown`, the same as `functions/_middleware.ts` on Cloudflare. Add `SITE_URL`, `CONTACT_EMAIL` and `GA_MEASUREMENT_ID` as environment variables. Until `SITE_URL` is set, the build uses the project's production address (`VERCEL_PROJECT_PRODUCTION_URL`).

## Deploy to Netlify

Add the rewrites to `public/_redirects` before you build:

```
/translink-rt/*  https://gtfsrt.api.translink.com.au/api/realtime/:splat  200
/qfd-bushfires   https://publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com/content/Feeds/BushfireCurrentIncidents/bushfireAlert.json  200
```

## Deploy elsewhere

On any other host, serve `dist/` and add a reverse proxy for the two paths in the table. If the proxies run on another origin, point the app at them at build time:

```bash
VITE_TRANSLINK_RT_BASE=https://proxy.example.com/translink-rt VITE_QFD_BUSHFIRES_URL=https://proxy.example.com/qfd-bushfires npm run build
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
