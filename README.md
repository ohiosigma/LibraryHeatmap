# StudySignal — Stony Brook campus companion

Current app snapshot: study-space activity, campus maps and floor plans, walking navigation, SBU transit, saved spaces, and a study-break planner.

Live app: https://studysignal-sbu.merrycove14.chatgpt.site (existing access restrictions apply).

## Source

- `public/`: browser app, building-specific study-group page, and published map/GTFS snapshots.
- `legacy/`: preserved original raffle and study-group prototype; the current app serves its study-group page from `public/study-groups.html`.
- `worker/`: Cloudflare Worker APIs for shared reports/presence, study groups, and live transit.
- `drizzle/`: D1 database migrations.
- `scripts/build.mjs`: embeds public assets and APIs into `dist/server/index.js`.
- `tests/`: transit decoding, UI wiring, reporting, installation, and study-break planning checks.

## Build and check

Requires Node.js 20+; no npm dependencies are needed.

```sh
node scripts/build.mjs
node tests/transit.mjs
node tests/transit-ui.cjs
node tests/student-tools.cjs
node tests/reporting.cjs
node tests/preferences.cjs
node tests/favorites.cjs
node tests/favorite-summary.cjs
node tests/api.mjs
node tests/pwa.mjs
node tests/laundry.mjs
```

For a local preview with the real transit proxy (no shared presence/report database):

```sh
node scripts/preview.mjs
```

For a static UI preview:

```sh
python3 -m http.server 8080 --directory public
```

Static hosting, including GitHub Pages, does not run `/api/state`, `/api/presence`, `/api/report`, or `/api/transit`. Shared activity, live transit, and cross-device study groups need the Worker backend; static hosting alone stores newly created study groups only in that browser. Worker deployment needs a D1 binding named `DB` and both migrations (`0000_shared_activity.sql` and `0001_study_groups.sql`) applied. `.openai/hosting.json` identifies the existing Sites deployment and is not a GitHub deployment workflow.

## Data and limitations

Building footprints and outdoor paths: OpenStreetMap. Indoor plans: published SBU sources, with coverage and dates shown in the UI. Transit uses ETA's public SBU GTFS feeds; refresh the static snapshot with `python3 scripts/update-transit.py`.

Location is optional. Browser location cannot reliably continue after the app closes. Study activity counts participating sessions and reports, not total occupancy. Saved study spaces stay in browser storage. The study-break planner estimates mapped walking time with a 10-minute buffer and at least 15 minutes to study; it does not verify seats or opening hours.

## Install StudySignal

The app includes a standalone web-app manifest, phone icons, and installation help under **About**. On iPhone/iPad, open the hosted HTTPS address in Safari, then Share → Add to Home Screen (keep Open as Web App enabled if offered). On Android, use Chrome’s Install app / Add to Home screen menu, or the in-app install button when available.

Phone installation requires the hosted HTTPS URL; `127.0.0.1` on your phone refers to the phone itself, not this development computer. Existing sign-in/access restrictions still apply. Installation is not App Store distribution. Browser and installed-app storage can be separate; saved spaces are not synchronized.

The service worker caches only a small offline information screen. Campus map loading, shared activity, and transit require connectivity. It never caches API responses or a private app shell. Do not describe this as full offline navigation or background GPS support. Bump the offline cache version in `public/service-worker.js` when changing its cached screen.

## Product scope

StudySignal focuses on finding a study space and getting there. The former campus-tools dashboard was replaced with **Study break**: available minutes, starting building, destination, and suitable study-space suggestions. Manual schedules, dining hours, events, resource pins, issue notes, meetup planning, and laundry links are removed. Existing browser records from those retired tools are left untouched but are not read by the app. Building links remain shareable from the map.

## Visual theme

The interface uses Stony Brook Red (`#990000`), black, and white with neutral gray surfaces, based on [SBU color guidelines](https://www.stonybrook.edu/sbu-brand/design-visual-identity/colors). `public/brand.css` contains the shared theme. Availability indicators and transit line colors retain their data meanings. StudySignal remains an independent student app.

## Study preference filters

Quiet, Group study, and Outlets preferences are shared between the campus map, building-area cards, library filters, and walking finder. They persist in this browser. Matching requires explicitly listed amenities; missing information is not a match. Buildings without matching listed areas are dimmed and excluded from search results. Clear resets the preferences. Area cards distinguish reported seat conditions from listed amenities and show report freshness; they do not imply live seat counts.

## Spaces / favorite buildings

The pin-icon Spaces tab lists favorite buildings. Use the heart in each building’s sticky header to add or remove it; use View building in Spaces to reopen its map details. Favorites persist locally under `ss-favorite-buildings` and update between tabs. They do not require account access or confirmed occupancy, and preference filters do not hide saved buildings. Existing `ss-saved` indoor-zone records are preserved separately.

Spaces cards include reported-open area counts, 30-minute report coverage and freshness, listed amenity counts, a few area statuses, and recent participating app sessions. They update with shared-state refreshes and distinguish an unavailable service from zero check-ins. Check-ins never imply measured seat availability; full building details remain optional.
