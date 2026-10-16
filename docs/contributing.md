# Contributing

This page sets out how code in this project is written and how to check a change. Read [Architecture](architecture.md) first for how the parts fit together.

## Show only published data

Every time, position, delay and count on screen must come from an official source. Do not interpolate, extrapolate or default a value to make a feature work. If a feature needs a number that no source publishes, leave the feature out, or link to the official tool that owns it, as the journey planner does for walking trips.

Label where data comes from. A real-time time says it is real-time. A timetabled time says it is timetabled.

## Parse external data at the boundary

Each source has one module in `src/api/` that fetches it and turns it into a domain type. Validate there and nowhere else.

- Treat a response as `unknown` until it is parsed. Use a zod schema for JSON from outside the project, as `parseBushfires()` in `src/api/bushfires.ts` does.
- Keep parsing in a pure function, separate from `fetch`, so it can be tested with a fixture.
- Inside the app, trust the types. Do not re-check a field that the boundary already validated.
- Do not use `as` to silence the compiler. If a cast is unavoidable, cast only data that has already been validated.

## Keep logic pure and in `src/lib/`

Schedules, filters, alert rules and the planner are pure functions in `src/lib/`. They take data and return data, with no React, no fetching and no global state. Components call them. This keeps them testable and keeps components readable.

## Keep files small and layers few

- Keep each file under 1,000 lines. If a change would push a file over, split it first, as `src/components/map/` was split out of `TrafficMap.tsx`.
- Do not add a wrapper or helper that has one caller and hides nothing. Inline it.
- Derive values instead of syncing state. If two pieces of state must agree, compute one from the other.
- Do not suppress a lint rule. Fix the cause. For a React effect that must read the latest props without re-running, use `useEffectEvent`.

## Write comments for what the code cannot say

Name things so the code explains itself. Write a comment only for:

- A fact about an outside system that the code must work around. For example, TransLink's T-code mapping files trains under the line they end on.
- The contract of an exported function, type or component, as a doc comment.
- A link to the source of a constraint, such as a dataset page.

Do not narrate what the next line does.

## Follow the Kumo design rules

The UI uses Kumo. Content text is 14px (`text-sm`). Only headings are larger. Headings are sentence case. Hover colours change instantly, without transitions. Use `ring ring-kumo-line` for borders, never `border` with a shadow.

Never rely on colour alone:

- Links in or next to text are underlined (`underline decoration-1 underline-offset-2`). A link that opens a new tab ends with `<NewTabNote />`, which tells screen readers.
- Status tags are Kumo `Badge` pills. Toggle chips (buttons with `aria-pressed` or `role="radio"`) use `rounded-md`, so a tag never looks clickable.
- The title of a card in a list is a heading (`Text as="h3"`) holding the card's button, whose `::after` stretches over the card. See `EventCard`.

## Edit the public pages

The About, Privacy, Contact and 404 pages, and the home page's description, are Markdown files in `site/pages/`. `site/llms.txt` tells AI agents what Roadbeat is for. Edit those files, not generated output. Keep the Privacy page true to the code: if a change stores, sends or asks for new information, update `site/pages/privacy.md` in the same change.

## Test the change

1. Add or update unit tests for logic in `src/lib/` and parsing in `src/api/`. Tests sit next to the file they test, as `*.test.ts`. Shared fixtures are in `src/test/fixtures.ts`. Test behaviour through the public function, not its internals.
2. Run the checks:

   ```bash
   npm test
   ```

   ```bash
   npm run lint
   ```

   ```bash
   npm run build
   ```

3. Run the app with `npm run dev` and use the feature in the browser. For anything that shows times or positions, compare a few values with the official source, such as TransLink's own timetable or stop page.
