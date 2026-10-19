# Product

What Roadbeat is, who it's for, the commitments it keeps, and what it deliberately doesn't do yet. The rules for changing it are in [AGENTS.md](../AGENTS.md); how it's built is in [Architecture](architecture.md).

## Users

People who drive, ride or take public transport in Queensland, checking a trip before they leave or while conditions change: commuters, truck and caravan drivers, people in towns cut off by floods or fires, and anyone watching a storm, cyclone or bushfire near home.

## Purpose

Roadbeat puts the official sources a Queensland trip depends on in one free map and list: QLDTraffic road events and cameras, Translink timetables and live services, Queensland Fire Department and Disaster Management warnings, council disaster dashboards, gauges, air quality and the rest in [Data sources](data-sources.md). Success is people checking Roadbeat because what it shows is exactly what the publishers say, with nothing added.

## Positioning

Roadbeat shows only what official sources publish, says who published it and when, and says plainly when a source is missing. A general traffic or maps app fills gaps with estimates and predictions; Roadbeat doesn't, and that is the point of it. Two kinds of item aren't official and are always labelled as such: the Waze reports that QLDTraffic itself passes on, and news stories, credited to the outlet that published them. It's independent and not affiliated with the Queensland Government or any publisher.

## Commitments

- **Name:** Roadbeat, one word, capital R. The site is www.roadbeat.app.
- **Voice:** plain Australian English, short sentences, sentence-case headings. Calm in an emergency: say what the source says and point to Triple Zero (000) and the official agency. No hype, no jokes in warnings.
- **Free:** no accounts, no ads, no subscriptions, no paid tiers. Support is by donation only ([Buy Me a Coffee](https://buymeacoffee.com/realbakari)). Open-Meteo's free terms, which the model forecast relies on, require a non-commercial site.
- **Privacy:** settings, saved stops, places and trips stay in the browser. The server keeps only what [Privacy](../site/pages/privacy.md) lists: a commute for push alerts, a feedback message, and visitor counts that identify no one. Page views are measured by Vercel Web Analytics and, where it's set up, Google Analytics, as that page describes.
- **Open source:** MIT licence, built on free tiers (Vercel Hobby, Upstash's free Redis, free map tiles).

## Evidence on hand

Roadbeat has no testimonials, press or published usage figures. Don't write any, or imply them, in the app, the site pages or the README. The header's visitor count is an estimate (a HyperLogLog), not an exact figure to quote.

## Not now

Each of these was considered and set aside. Building one needs the maintainer's decision first, and other work must not be designed as if it exists. The reason says what would have to change.

| Not now | Why |
|---|---|
| Estimated arrival times, vehicle positions between GPS reports, walking times | No source publishes them; Roadbeat would be guessing. Trips that need a walk go to Translink's journey planner. |
| Accounts, sign-in, profiles | Nothing needs them: preferences stay in the browser. |
| Ads, sponsorships, subscriptions | Roadbeat stays free and non-commercial, which Open-Meteo's terms require. |
| Bureau of Meteorology warnings and products beyond QLDTraffic's radar | Needs the Bureau's written permission. The ingest is built and switched off (`NEWS_BOM_WARNINGS`). |
| Brand logos for fuel stations or other companies | No source publishes them, and copying the artwork needs each company's permission. Brands are shown by name. |
| Community data from OpenStreetMap as places (hospitals, fuel stations, speed cameras) | Not official. OpenStreetMap stays as the base map only. |
| Mobile speed camera positions | The state publishes the sites by road and suburb, not by position, so they're linked rather than placed. |
| An AI chat on `/chat` | Free model tiers exist, but answers could be worded wrongly, and the provider would see people's questions. Connecting an assistant to Roadbeat's MCP server (`/mcp`) covers it for now. Google AI Mode has no API to build on. |
| Reading sites that publish no feed (9News, The Courier-Mail) | Scraping isn't a published feed, and their terms don't allow it. |
| Showing a third party's copy of an official feed when the official one is reachable | Go to the publisher. |

## Maybe later

Worth doing, not yet built:

- Hillshade relief on the base map, for flood and fire context.
- A measuring tool and a grid on the map (judged low priority).

## Waiting on someone else

- **Bureau of Meteorology:** written permission for its warnings.
- **Address search:** built on a branch, held until the geocoder's terms are clear.
