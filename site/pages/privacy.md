---
title: Privacy
<!--if:GA_MEASUREMENT_ID-->
description: Roadbeat has no accounts or advertising and uses Google Analytics to count visits. Your settings and location stay in your browser unless you turn on commute push alerts.
<!--endif-->
<!--ifnot:GA_MEASUREMENT_ID-->
description: Roadbeat has no accounts, no cookies and no analytics. Your settings and location stay in your browser unless you turn on commute push alerts.
<!--endif-->
---

# Privacy

Roadbeat is built to need as little information about you as possible. <!--if:GA_MEASUREMENT_ID-->
There are no accounts and no advertising. Roadbeat uses Google Analytics to count visits, as described below.
<!--endif-->
<!--ifnot:GA_MEASUREMENT_ID-->
There are no accounts, no cookies, no advertising and no analytics.
<!--endif-->

## What stays in your browser

Roadbeat saves your preferences in your browser's local storage, on your device only. That includes your notification settings and notification list, your saved stops, recent stops and saved trips, your commute (roads, stop, line, time and days), and display choices such as the colour theme, base map, panel size and time format. Roadbeat never sends this information to a server. Clearing your browser's site data for Roadbeat deletes it.

## Your location

Roadbeat asks for your location only when you choose a feature that needs it, such as **Find stops near me**, sorting events by distance, or alerts near you. Your browser asks for your permission first. Roadbeat uses your location inside your browser to sort and filter what you see, and does not send it to any server. If you turn on alerts near you, your chosen location is saved in local storage with your other settings.

## Data sources you connect to

To show live information, your browser requests data from official sources: the Department of Transport and Main Roads (QLDTraffic), Translink, the Queensland Fire Department and Brisbane City Council, and map tiles from OpenFreeMap. Some requests pass through Roadbeat's own small proxy, because those sources do not allow browsers to read them directly. Like any website, these services and Roadbeat's host can see your IP address and the request when your browser connects. Roadbeat does not combine this with any other information.

The **News** tab and the dashboard read headlines from Roadbeat's own server, which collects them from news publishers' and government feeds. To show who published each report, your browser loads each publisher's small site icon from that publisher's own website, which can see your IP address, as with any website. Council flood camera images load the same way, from each council's camera provider. Opening a report takes you to the publisher's site under its privacy terms.

When you open **Directions** for a place, Google Maps opens in a new tab under Google's own privacy terms.

<!--if:GA_MEASUREMENT_ID-->
## Analytics

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
