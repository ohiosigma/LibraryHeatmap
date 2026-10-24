# StudySignal: continuation handoff

Prepared October 24, 2026. Read this and README.md before continuing.

## Immediate task

The user wants to continue this project in Codex and upload the current version to https://github.com/ohiosigma/LibraryHeatmap on `main`.

This checkout is the prepared GitHub working copy:
`/Users/tahmidtapan/Documents/Codex/2026-10-22/i-have-a-hackathon-tmr-that/github-upload`

- App upload commit: `08395d1` (Upload current StudySignal campus companion app).
- This handoff is a subsequent local documentation commit.
- Neither commit has been successfully pushed as of this handoff.
- Remote main when cloned: `970eb220c0036fa3deb4b809a309f361c674adf5`.
- Previous GitHub prototype is preserved in `legacy/`; do not discard it.
- HTTPS clone and ls-remote worked. Push repeatedly failed: `could not read Username for 'https://github.com': Device not configured`.
- `gh` was not installed. SSH attempt failed hostname resolution.
- User authorized publishing this snapshot to that repository. Authenticate through a supported GitHub flow if needed; never ask for passwords/tokens in chat or extract browser cookies. A signed-in Chrome tab is not Git authentication.
- Fetch and inspect remote changes before pushing. Preserve concurrent work; do not force-push. Verify remote SHA after successful upload. Do not claim success on a failed push.

## Product and design intent

StudySignal began as a Waze-like study-space tracker for a four-person SBU hackathon team targeting the UI/UX prize. It is expanding into a Stony Brook student companion: find a space, get there, and use time between classes well.

Design preferences: clean Apple/Robinhood-inspired interface, minimal visual clutter, map first, mobile-friendly. Waze-inspired full-screen walking mode after Start walking. Keep map layers and tool panels understandable rather than displaying every feature simultaneously.

User prefers autonomous implementation with concise progress updates, few unnecessary confirmation questions, and honest status about live data and verification.

## Checkouts and deployment

Original Sites checkout (a separate Git history):
`/Users/tahmidtapan/Documents/Codex/2026-10-22/i-have-a-hackathon-tmr-that/studysignal`

Use THIS github-upload checkout for GitHub work. Do not accidentally push its history to the Sites source repository. The original Sites checkout is a historical deployment source and will not automatically receive future GitHub changes.

Live app: https://studysignal-sbu.merrycove14.chatgpt.site
Sample study activity: add `?demo=1`.

Sites project: `appgprj_6adc07397f9081919c823f0aae302202`.
Last published Sites source SHA: `c2e7768d906200e1743aac38508136ea38876845`.
Last successful deployment: `appgdep_6add42c8e7c08191b1801798c5356526`.
Site is owner-private; do not change its audience without user instruction.
`.openai/hosting.json` refers to that existing project. It is not a GitHub deployment workflow. Uploading code to GitHub does not deploy a working backend there.

## Architecture and build

Dependency-free browser JavaScript with local Leaflet and MapLibre assets. Cloudflare Worker ESM backend; D1 database binding `DB`.

- `public/index.html`: actual UI. Repository root index redirects here for static previews.
- `public/app.js`: Melville indoor study zones, shared globals, UI helpers.
- `public/campus.js`: real building footprints, building panels, indoor views; exposes `window.studyCampus`.
- `public/interface.js`, `interface.css`: clean map-first shell and bottom navigation.
- `public/plans.js`, `plans/`: published indoor plans with dates/coverage caveats.
- `public/presence.js`: confirmed building/area check-ins, reports, shared-state polling.
- `public/simulation.js`: explicitly labeled sample study activity; no fake report writes.
- `public/walking.js`: local pedestrian graph routing, spot picker, live GPS lifecycle; `window.WalkRouting` exposes distance/paths/routeTo/load.
- `public/navigation.js`, `navigation.css`: tilted MapLibre walking view, purple route, position arrow, instructions, ETA, overview/recenter/exit.
- `public/transit.js`, `transit.css`: transit toggle, route filter, stops, buses, arrivals, alerts.
- `public/transit-data.json`: static ETA GTFS snapshot; 14 routes and 69 stops when checked.
- `public/student-tools.js`, `student-tools.css`: Today & campus dialog.
- `worker/api.mjs`: D1 presence/report APIs, origin validation, HttpOnly session cookies.
- `worker/transit.mjs`: bounded GTFS protobuf decoding and upstream transit fetches, with 15-second in-memory reuse.
- `drizzle/0000_shared_activity.sql`: presence/reports migration; already applied on hosted site. Do not edit an applied migration to add new schema.
- `scripts/build.mjs`: embeds public files and backend into `dist/server/index.js`, copies hosting manifest.
- `scripts/update-transit.py`: refreshes the static GTFS snapshot.

Node.js 20+; no npm install needed:

```sh
node scripts/build.mjs
node tests/transit.mjs
node tests/transit-ui.cjs
node tests/student-tools.cjs
```

These passed before handoff. Generated `dist/` is ignored in this GitHub checkout. Build it before Worker deployment.

Static preview: `python3 -m http.server 8080 --directory public`.
This does NOT serve APIs. A complete preview needs a Worker-compatible server and the DB binding. GitHub Pages alone cannot run shared reports or the live transit proxy.

## Implemented functionality and important limits

### Study maps and activity

198 OSM building footprints, local muted campus roads/paths/greens/water. Labels appear on selection/hover rather than cluttering the map. About 5,538 nodes and 5,874 segments in pedestrian graph at extraction.

Melville first-floor image is from SBU Libraries. Selected SAC, Wang, Administration, Discovery, Life Sciences, HSC and Union diagrams are published plans/event layouts, sometimes old. Reporting overlays are approximate. HSC Level 2 is NOT the Level 3 Health Sciences Library interior. Do not fabricate missing floor plans, rooms, or occupancy.

Shared reports expire after 30 minutes. Gray means unknown, not empty. Presence counts participating sessions, not total headcount. Building/area location is user-confirmed; GPS does not determine a floor.

Presence currently heartbeats while the page is visible and expires after 3 minutes without updates. Page exit attempts removal. This is separate from the proposed 30-minute location snapshots discussed below; those were NOT implemented.

### Walking and location

Routes follow mapped outdoor pedestrian paths; accessibility, closures and exact entrance access are not guaranteed. Start walking now requests fresh high-accuracy GPS even when the route began from a manual building or sample activity mode. Previously those modes disabled tracking; this was fixed.

Weak readings show status and do not advance turns. Fresh fixes update marker and remaining distance. There is off-route recalculation, near-destination detection, and watcher cleanup on exit. GPS coordinates remain on device.

Browser controls update frequency. Closed/suspended web apps cannot promise periodic background GPS. User raised battery concerns. Discussed future design: precise GPS only while navigating; optional single readings at check-in/reopening; expiring check-ins and clear freshness. Native geofencing was discussed as a future alternative, not built. Do not represent a 30-minute census or background geofencing as implemented.

### Transit

Actual upstream base: `https://s3.amazonaws.com/etatransit.gtfs/stonybrook.etaspot.net/`.
Files: `gtfs.zip`, `position_updates.pb`, `trip_updates.pb`, `alerts.pb`.
Official tracker: https://stonybrook.etaspot.net/ .

UI polls `/api/transit` every 15 seconds while visible; stale readings older than 120 seconds are hidden. Distinguish direct feed predictions from schedule plus live delay. There is no combined walking/bus journey planner yet. Location is requested once for nearby-stop sorting, not to obtain bus positions.

### Today & campus tools

- Manual weekly classes, next class today (Eastern time).
- Study-break planner uses mapped path travel estimates, 10-minute buffer, and at least 15 minutes study time. It does not verify seats, opening hours or accessible routes.
- Dining regular hours for selected locations, checked Oct 24, 2026 from https://www.stonybrook.edu/dining/hours.html . These are a snapshot, not live service guarantees; holidays may differ.
- Personal printer/water/bathroom/outlet/accessibility pins: student-defined and unverified.
- Manually saved events with organizer URLs and optional free-food flag; no university event ingestion.
- Group meeting building suggested from chosen starting buildings using straight-line proximity; copyable building link, not synchronized group presence.
- Private issue notes with resolved/reopen; NOT submitted to university staff or shared campus-wide.
- Persistent local laundry timer and SBU service link; NO live machine availability or background notifications.

All these personal tool records are browser-local. Do not call them shared integrations. Calendar import, continuous schedule alerts, event feeds, and cross-device syncing are not implemented.

## Verification and next work

Automated tests cover transit protobuf decoding (including signed delays), stale/skipped/cancelled data, active alerts, UI toggle/filter/cleanup, student-tool saves and map wiring. Earlier temporary tests also checked walking connectivity and simulated GPS lifecycle. Those temporary scripts were in `/tmp` on the original machine and are not repository tests.

Live transit returned real positions/arrivals in endpoint checks. Prior browser-control tools were unavailable and preview-panel opening failed. Visual QA on a real phone, actual GPS walking, battery usage, accessibility, and all new dialog layouts remain unverified. Do not claim full end-to-end or device validation.

Immediate sequence:
1. Inspect repository state and authenticate GitHub using available authorized tools.
2. Push prepared source plus this handoff safely and verify remote commit.
3. Report exact GitHub commit URL.
4. Continue product work only as requested; prioritize mobile visual QA and integrated flows over adding disconnected features.
