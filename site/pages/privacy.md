---
title: Privacy
<!--if:GA_MEASUREMENT_ID-->
description: No accounts or ads. Google Analytics measures use. Your location stays in your browser, and so do your settings unless you turn on push alerts.
<!--endif-->
<!--ifnot:GA_MEASUREMENT_ID-->
description: No accounts, ads or cookies. Visits are counted without identifying you. Your location, and your settings unless you turn on push alerts, stay in your browser.
<!--endif-->
---

# Privacy

Roadbeat is built to need as little information about you as possible. There are no accounts and no advertising. Roadbeat counts how many people use it without cookies and without identifying you, as described under [Analytics](#analytics).<!--if:GA_MEASUREMENT_ID--> It also uses Google Analytics, described below.<!--endif-->

## What stays in your browser

Roadbeat saves your preferences in your browser's local storage, on your device only. That includes your notification settings and notification list, your saved stops, recent stops and saved trips, your commute (roads, stop, line, time and days), and display choices such as the colour theme, base map, panel size, time format and which dashboard panels show. Roadbeat never sends this information to a server. Clearing your browser's site data for Roadbeat deletes it.

Saved trips, with the names, order and travel modes you give them, stay in this browser too: Roadbeat plans their next departures on your device and never sends them anywhere.

## Your location

Roadbeat asks for your location only when you choose a feature that needs it, such as **Find stops near me**, sorting events by distance, or alerts near you. Your browser asks for your permission first. Roadbeat uses your location inside your browser to sort and filter what you see, and does not send it to any server. If you turn on alerts near you, your chosen location is saved in local storage with your other settings.

## Data sources you connect to

To show live information, your browser requests data from official sources: the Department of Transport and Main Roads (QLDTraffic), Translink, the Queensland Fire Department, Brisbane City Council, the Department of Environment, Tourism, Science and Innovation's air quality service when you open a station's history, data.qld.gov.au for crash history, the Department of Local Government, Water and Volunteers' stream gauges and, if you turn those layers on, Geoscience Australia's satellite hotspots, NASA's satellite imagery, the NSW Rural Fire Service and the US Joint Typhoon Warning Center, Open-Meteo for the model forecast on a place page, and map tiles from OpenFreeMap. Open-Meteo is sent only the place's coordinates. Brisbane City Council's event images load from its events calendar host, Trumba. Some requests pass through Roadbeat's own small proxy, because those sources do not allow browsers to read them directly. Like any website, these services and Roadbeat's host can see your IP address and the request when your browser connects. Roadbeat does not combine this with any other information.

The **News** tab and the dashboard read headlines from Roadbeat's own server, which collects them from news publishers' and government feeds. To show who published each report, your browser loads each publisher's small site icon from that publisher's own website, which can see your IP address, as with any website. Council flood camera images load the same way, from each council's camera provider. Opening a report takes you to the publisher's site under its privacy terms.

When you open **Directions** for a place, Google Maps opens in a new tab under Google's own privacy terms.

## Analytics

Roadbeat counts how many people use it, so the count can be shown in the app and so it is clear whether the app is used. Two things count, and neither uses cookies or receives your saved stops, settings or location:

- **Vercel Web Analytics**, run by Roadbeat's host, records page views. It tells visits apart within a day using a hash of your IP address and browser that changes every day, so it cannot identify you or follow you between days. Vercel describes this in its [Web Analytics privacy policy](https://vercel.com/docs/analytics/privacy-policy).
- **The visitor count in the header** comes from Roadbeat's own server. While the app is open, your browser tells the server every five minutes that someone is here. The server counts you under an id made by hashing your IP address, your browser and the date with a secret it keeps, so the id cannot be turned back into your address and changes every day. The id itself is not stored: it goes into a counter that keeps only an estimate of how many different ids it saw today and in the last ten minutes, and each day's counter is deleted after two days.

<!--if:GA_MEASUREMENT_ID-->
## Google Analytics

Roadbeat uses Google Analytics to count visits and see which pages and features people use, so it can improve the app. Google Analytics sets cookies in your browser and receives your IP address, your browser and device type, the pages you view and where you came from. Roadbeat does not send it your saved stops, settings or location. Google handles this data under the [Google Privacy Policy](https://policies.google.com/privacy). To opt out, block cookies for Roadbeat in your browser or install the [Google Analytics opt-out add-on](https://tools.google.com/dlpage/gaoptout).

<!--endif-->
## Notifications

The alerts you set in **Notification settings** are created in your browser while Roadbeat is open. If you allow system notifications, your browser shows them. Nothing about them is sent to a server.

## Push alerts for your commute

Push alerts are off unless you turn them on in the **My commute** card. When you do, your browser creates a push subscription: an address at your browser maker's push service (such as Google, Apple or Mozilla) and the keys to encrypt messages to it. Roadbeat sends that subscription to its server together with your commute: the roads, stop, line, usual departure time and days you chose. It does not send your name, your location or anything else you've saved.

The server stores this in a database (Upstash Redis, through Roadbeat's host, Vercel) and uses it only to check the official feeds during your commute window and send you alerts. It also keeps the short ids of alerts it has already sent, so you don't get the same one twice. Each alert is encrypted and passes through your browser maker's push service to reach you.

Turning push alerts off, or removing your commute, deletes your subscription from the server. If your browser withdraws the subscription, for example because you blocked notifications, Roadbeat deletes it the next time it tries to send.

## Changes and questions

If this policy changes, this page will show the change. For questions about privacy, see the [Contact](/contact/) page.
