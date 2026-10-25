# StudySignal — Stony Brook campus companion

Current app snapshot: study-space activity, campus maps and floor plans, walking navigation, SBU transit, and personal student tools.

Live app: https://studysignal-sbu.merrycove14.chatgpt.site (existing access restrictions apply).

## Source

- `public/`: browser app, building-specific study-group page, and published map/GTFS snapshots.
- `legacy/`: preserved original raffle and study-group prototype; the current app serves its study-group page from `public/study-groups.html`.
- `worker/`: Cloudflare Worker APIs for shared reports/presence, study groups, and live transit.
- `drizzle/`: D1 database migrations.
- `scripts/build.mjs`: embeds public assets and APIs into `dist/server/index.js`.
- `tests/`: transit decoding, UI wiring, and student-tool checks.

## Build and check

Requires Node.js 20+; no npm dependencies are needed.

```sh
node scripts/build.mjs
node tests/transit.mjs
node tests/transit-ui.cjs
node tests/student-tools.cjs
```

For a static UI preview:

```sh
python3 -m http.server 8080 --directory public
```

Static hosting, including GitHub Pages, does not run `/api/state`, `/api/presence`, `/api/report`, or `/api/transit`. Shared activity, live transit, and cross-device study groups need the Worker backend; static hosting alone stores newly created study groups only in that browser. Worker deployment needs a D1 binding named `DB` and both migrations (`0000_shared_activity.sql` and `0001_study_groups.sql`) applied. `.openai/hosting.json` identifies the existing Sites deployment and is not a GitHub deployment workflow.

## Data and limitations

Building footprints and outdoor paths: OpenStreetMap. Indoor plans: published SBU sources, with coverage and dates shown in the UI. Transit uses ETA's public SBU GTFS feeds; refresh the static snapshot with `python3 scripts/update-transit.py`. Dining displays published regular hours checked October 24, 2026, not live service guarantees.

Location is optional. Browser location cannot reliably continue after the app closes. Study activity counts participating sessions and reports, not total occupancy. Personal schedules, events, resource pins, issue notes, and laundry timers stay in browser storage. Live event and laundry-machine feeds are not connected.
