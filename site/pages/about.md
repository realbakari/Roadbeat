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
- **Public transport:** Translink's published timetables (GTFS) and live feeds (GTFS-RT) for South East Queensland and Cairns.
- **Bushfire warnings:** the Queensland Fire Department's current incidents feed.
- **Stream heights, rainfall and signal traffic:** Brisbane City Council's open data.
- **Crash history:** the Department of Transport and Main Roads' crash data on data.qld.gov.au.
- **Maps:** OpenFreeMap, OpenMapTiles and OpenStreetMap contributors.

All government data is used under the Creative Commons Attribution 4.0 licence.

## What Roadbeat is not

Roadbeat is an independent project. It is not run, affiliated with or endorsed by the Queensland Government, Translink, the Queensland Fire Department or Brisbane City Council. It is not an emergency service. For emergencies, call Triple Zero (000). For official road information, call 13 19 40 or visit qldtraffic.qld.gov.au. For public transport, call 13 12 30 or visit translink.com.au.

## How Roadbeat is built

Roadbeat is a web app built with React, MapLibre and Cloudflare's Kumo components. It runs in your browser and does not need an account.
