---
title: About Roadbeat
description: What Roadbeat is, where its data comes from, and why it shows only official, published information.
---

# About Roadbeat

Roadbeat is a free web app for people who drive, ride or take public transport in Queensland. It brings together live road conditions, traffic cameras, public transport, timetables and bushfire warnings, so you can check your trip in one place.

## Official data only

Every time, position, delay and count in Roadbeat comes from an official source. Roadbeat does not fill gaps with estimates. A bus between two GPS reports is shown where it last reported. A journey that needs a walk between stops is handed to TransLink's own journey planner, because no source publishes walking times. When a source has no data, Roadbeat says so.

## Where the data comes from

- **Road events, cameras, rest areas and rain radar:** the Department of Transport and Main Roads, through the feeds behind qldtraffic.qld.gov.au.
- **Public transport:** Translink's published timetables (GTFS) and live feeds (GTFS-RT) for South East Queensland and Cairns, and the published timetables of Translink's 17 other regional networks, with live times wherever TransLink's feed for that region carries them.
- **Bushfire warnings:** the Queensland Fire Department's current incidents feed.
- **Stream heights, rainfall, signal traffic, planned council road closures and CBD car park spaces:** Brisbane City Council's open data.
- **Clearways, public toilets, accessible parking, ferry terminal access and the February 2022 flood extent:** Brisbane City Council's open data. Toilets come from the National Public Toilet Map.
- **Station access and facilities:** Queensland Rail's station details, published by Brisbane City Council. Lift and escalator outages come from Translink's alerts.
- **Statewide stream heights:** the latest reading at the Queensland Government's open gauging stations, from the Department of Local Government, Water and Volunteers' Water Monitoring Information Portal.
- **Flood warning areas:** the Bureau of Meteorology's National Flood Gauge Network, used to link each Brisbane gauge to BoM's flood warning for its area.
- **Crash history:** the Department of Transport and Main Roads' crash data on data.qld.gov.au.
- **Satellite hotspots:** Geoscience Australia's Digital Earth Australia Hotspots, which gathers heat detected by NASA, NOAA, Japanese and other satellites. A hotspot is heat a satellite saw, not a confirmed fire.
- **Satellite image:** NASA's Global Imagery Browse Services, from the NOAA-20 satellite's daily pass.
- **Maps:** OpenFreeMap, OpenMapTiles and OpenStreetMap contributors.

Australian and Queensland Government data is used under the Creative Commons Attribution 4.0 licence. NASA's imagery has no use restrictions.

## Find a station, line or place

Three directories list what the app covers, as plain pages a search engine can read: every [train station, tram stop and ferry terminal](/stations/) in South East Queensland, every [TransLink line and regional route](/lines/), and every [Queensland town, suburb and locality](/places/). Each page names only what TransLink and the Queensland place names gazetteer publish, and opens the live view in the app.

## Support Roadbeat

Roadbeat is free to use, with no ads and no account. If it's useful to you, you can support it at [Buy Me a Coffee](https://buymeacoffee.com/realbakari).

## What Roadbeat is not

Roadbeat is an independent project. It is not run, affiliated with or endorsed by the Queensland Government, Translink, the Queensland Fire Department or Brisbane City Council. It is not an emergency service. For emergencies, call Triple Zero (000). For official road information, call 13 19 40 or visit qldtraffic.qld.gov.au. For public transport, call 13 12 30 or visit translink.com.au.

## How Roadbeat is built

Roadbeat is a web app built with React, MapLibre and Cloudflare's Kumo components. It runs in your browser and does not need an account.
