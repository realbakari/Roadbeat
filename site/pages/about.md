---
title: About
description: What Roadbeat is, where its data comes from, and why it shows only official, published information.
---

# About Roadbeat

Roadbeat is a free web app for people who drive, ride or take public transport in Queensland. It brings together live road conditions, traffic cameras, public transport, timetables, bushfire warnings, flood gauges, air quality, power outages and council and police notices, so you can check your trip in one place.

## Official data only

Every time, position, delay and count in Roadbeat comes from an official source. Roadbeat does not fill gaps with estimates. News stories are the one exception to official sources, and they are always labelled with the outlet that published them. A bus between two GPS reports is shown where it last reported. A journey that needs a walk between stops is handed to TransLink's own journey planner, because no source publishes walking times. When a source has no data, Roadbeat says so.

## Where the data comes from

- **Road events, cameras, rest areas, truck restrictions and the Waze reports QLDTraffic shows:** the Department of Transport and Main Roads, through the feeds behind qldtraffic.qld.gov.au.
- **Rain radar:** the Bureau of Meteorology's radar images, as QLDTraffic publishes them.
- **Public transport:** Translink's published timetables (GTFS) and live feeds (GTFS-RT) for South East Queensland and Cairns, and the published timetables of Translink's 17 other regional networks, with live times wherever TransLink's feed for that region carries them.
- **Bushfire warnings:** the Queensland Fire Department's current incidents feed.
- **Stream heights, rainfall, signal traffic, planned council road closures, CBD car park spaces, pedestrian counts, corridor travel times and council events:** Brisbane City Council's open data.
- **Clearways, low clearances, public toilets, accessible parking, parking meters, bike racks, bikeways, bus stop and ferry terminal access and the February 2022 flood extent:** Brisbane City Council's open data. Toilets come from the National Public Toilet Map, and rail bridge clearances from Queensland Rail.
- **Station access and facilities:** Queensland Rail's station details, published by Brisbane City Council. Lift and escalator outages come from Translink's alerts.
- **Statewide stream heights:** the latest reading at the Queensland Government's open gauging stations, from the Department of Local Government, Water and Volunteers' Water Monitoring Information Portal.
- **Flood warning areas:** the Bureau of Meteorology's National Flood Gauge Network, used to link each Brisbane gauge to BoM's flood warning for its area.
- **Crash history:** the Department of Transport and Main Roads' crash data on data.qld.gov.au.
- **Air quality:** the Department of Environment, Tourism, Science and Innovation's hourly air quality feed, and its Air Quality API for each station's history.
- **Council notices, evacuation centres, council cameras and Energex power outages:** the disaster dashboards of 58 Queensland councils. The power outages are Energex's, as the councils' dashboards relay them.
- **Police media releases:** the Queensland Police Service.
- **Earthquakes:** Geoscience Australia's earthquakes of the last seven days in or off Queensland.
- **News stories:** the headline, link and first sentence of reports in the Queensland feeds of ABC News, 7NEWS, Brisbane Times, Guardian Australia and SBS News. Each links to the publisher's own report.
- **Satellite hotspots:** Geoscience Australia's Digital Earth Australia Hotspots, which gathers heat detected by NASA, NOAA, Japanese and other satellites. A hotspot is heat a satellite saw, not a confirmed fire.
- **Satellite image:** NASA's Global Imagery Browse Services, from the NOAA-20 satellite's daily pass.
- **Maps:** OpenFreeMap, OpenMapTiles and OpenStreetMap contributors.

Most of this data is published under the Creative Commons Attribution 4.0 licence: that of the Department of Transport and Main Roads, Translink, the Queensland Fire Department, Brisbane City Council, the Department of Environment, Tourism, Science and Innovation, the Department of Local Government, Water and Volunteers, the Department of Resources, the Queensland Police Service, Geoscience Australia and the Bureau of Meteorology's flood gauge network. Roadbeat credits each publisher as that licence asks. The Bureau of Meteorology's radar images are shown as QLDTraffic publishes them. The councils' dashboards publish no licence; their notices, centres and outages are public safety information, shown as written and linked to each dashboard. NASA's imagery has no use restrictions. Map data is © OpenStreetMap contributors under the Open Database Licence. News headlines and summaries belong to their publishers, and Roadbeat shows only what a feed reader would.

## Find a station, line or place

Three directories list what the app covers, as plain pages a search engine can read: every [train station, tram stop and ferry terminal](/stations/) in South East Queensland, every [TransLink line and regional route](/lines/), and every [Queensland town, suburb and locality](/places/). Each page names only what TransLink and the Queensland place names gazetteer publish, and opens the live view in the app.

## Support Roadbeat

Roadbeat is free to use, with no ads and no account. If it's useful to you, you can support it at [Buy Me a Coffee](https://buymeacoffee.com/realbakari).

## What Roadbeat is not

Roadbeat is an independent project. It is not run by, affiliated with or endorsed by the Queensland Government, Translink, the Queensland Fire Department, Brisbane City Council or any other source above. It is not an emergency service. For emergencies, call Triple Zero (000). For official road information, call 13 19 40 or visit qldtraffic.qld.gov.au. For public transport, call 13 12 30 or visit translink.com.au.

## How Roadbeat is built

Roadbeat is a web app built with React, MapLibre and Cloudflare's Kumo components. It runs in your browser and does not need an account.
